// 찜·마셔 본 술 기록. 이 기기의 브라우저 저장소에만 두고 어디로도 보내지 않는다.

const KEY = 'sool-my-v1';
const APP = 'sool-finder';
const ID_RE = { drink: /^d-[0-9a-f]{8}$/, brewery: /^b-[0-9a-f]{8}$/ };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEMO_MAX = 100;
const NAME_MAX = 60;

function emptyState() {
  return { app: APP, v: 1, favDrinks: {}, favBreweries: {}, tasted: {}, lastSeen: null, adult: false };
}

function cleanRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

function cleanMemo(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MEMO_MAX) : '';
}

function cleanName(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
}

function cleanFavs(value, re) {
  const out = {};
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((id) => {
      if (re.test(id)) {
        out[id] = Number(value[id]) || 0;
      }
    });
  }
  return out;
}

function cleanTasted(value) {
  const out = {};
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((id) => {
      const rec = value[id];
      if (ID_RE.drink.test(id) && rec && typeof rec === 'object') {
        out[id] = {
          date: DATE_RE.test(rec.date) ? rec.date : null,
          rating: cleanRating(rec.rating),
          memo: cleanMemo(rec.memo),
          name: cleanName(rec.name),
        };
      }
    });
  }
  return out;
}

function clean(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') {
    return state;
  }
  state.favDrinks = cleanFavs(raw.favDrinks, ID_RE.drink);
  state.favBreweries = cleanFavs(raw.favBreweries, ID_RE.brewery);
  state.tasted = cleanTasted(raw.tasted);
  state.lastSeen = DATE_RE.test(raw.lastSeen) ? raw.lastSeen : null;
  state.adult = raw.adult === true;
  return state;
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch (err) {
    return null;
  }
}

export function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function createStore(storage = defaultStorage()) {
  let state = emptyState();

  // 다른 화면이나 다른 탭에서 바꾼 내용을 덮어쓰지 않도록, 읽고 쓸 때마다 저장된 것을 다시 읽는다.
  // 저장소가 막혀 있거나 아직 저장된 것이 없으면 지금 화면의 상태를 그대로 쓴다.
  function reload() {
    try {
      const text = storage?.getItem(KEY);
      if (typeof text === 'string') {
        state = clean(JSON.parse(text));
      }
    } catch (err) {
      // 그대로 둔다.
    }
  }

  function save() {
    try {
      storage?.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      // 저장이 막힌 환경에서는 이번 화면에서만 유지한다.
    }
  }

  const favMap = (kind) => (kind === 'brewery' ? state.favBreweries : state.favDrinks);

  const api = {
    isFav(kind, id) {
      return Object.hasOwn(favMap(kind), id);
    },
    /** 찜을 뒤집고 새 상태(찜했으면 true)를 돌려준다. */
    toggleFav(kind, id) {
      if (!ID_RE[kind]?.test(id)) {
        return false;
      }
      const map = favMap(kind);
      if (Object.hasOwn(map, id)) {
        delete map[id];
        save();
        return false;
      }
      map[id] = Date.now();
      save();
      return true;
    },
    /** 최근에 찜한 것부터. */
    listFav(kind) {
      const map = favMap(kind);
      return Object.keys(map).sort((a, b) => map[b] - map[a]);
    },
    getTasted(id) {
      return Object.hasOwn(state.tasted, id) ? { ...state.tasted[id] } : null;
    },
    /** 준 값만 바꾼다. 처음 기록한 날짜는 유지한다. */
    setTasted(id, patch = {}, date = today()) {
      if (!ID_RE.drink.test(id)) {
        return;
      }
      const old = Object.hasOwn(state.tasted, id) ? state.tasted[id] : { date: null, rating: null, memo: '', name: '' };
      state.tasted[id] = {
        date: old.date ?? (DATE_RE.test(date) ? date : null),
        rating: 'rating' in patch ? cleanRating(patch.rating) : old.rating,
        memo: 'memo' in patch ? cleanMemo(patch.memo) : old.memo,
        name: 'name' in patch ? cleanName(patch.name) : old.name,
      };
      save();
    },
    removeTasted(id) {
      if (Object.hasOwn(state.tasted, id)) {
        delete state.tasted[id];
        save();
      }
    },
    /** [{id, date, rating, memo, name}], 최근 기록부터. */
    listTasted() {
      return Object.keys(state.tasted)
        .map((id) => ({ id, ...state.tasted[id] }))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    },
    exportData() {
      const { favDrinks, favBreweries, tasted } = state;
      return JSON.stringify({ app: APP, v: 1, exported: today(), favDrinks, favBreweries, tasted }, null, 2);
    },
    /** 내보낸 파일 내용을 지금 기록에 합친다. 같은 술의 기록은 불러온 쪽으로 바꾼다. */
    importData(text) {
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object' || raw.app !== APP) {
        throw new Error('전통주 발견에서 내보낸 파일이 아닙니다');
      }
      const incoming = clean(raw);
      Object.assign(state.favDrinks, incoming.favDrinks);
      Object.assign(state.favBreweries, incoming.favBreweries);
      Object.assign(state.tasted, incoming.tasted);
      save();
      return {
        favDrinks: Object.keys(incoming.favDrinks).length,
        favBreweries: Object.keys(incoming.favBreweries).length,
        tasted: Object.keys(incoming.tasted).length,
      };
    },
    clearRecords() {
      state.favDrinks = {};
      state.favBreweries = {};
      state.tasted = {};
      save();
    },
    isAdult() {
      return state.adult;
    },
    confirmAdult() {
      state.adult = true;
      save();
    },
    lastSeen() {
      return state.lastSeen;
    },
    markSeen(date) {
      if (DATE_RE.test(date)) {
        state.lastSeen = date;
        save();
      }
    },
  };
  reload();
  return Object.fromEntries(Object.entries(api).map(([name, fn]) => [name, (...args) => {
    reload();
    return fn(...args);
  }]));
}

let shared = null;

/** 화면들이 함께 쓰는 저장소. */
export function myStore() {
  shared ??= createStore();
  return shared;
}
