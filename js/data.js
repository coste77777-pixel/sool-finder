const FILES = ['breweries', 'drinks', 'rankings', 'meta'];

let cache = null;
let breweryIndex = null;
let drinkIndex = null;
let byBrewery = null;
let scoreIndex = null;
let news = [];

async function fetchJson(name) {
  const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`${name}.json 을 불러오지 못했습니다 (${res.status})`);
  }
  return res.json();
}

/** 자료 네 파일을 한 번만 불러온다. 실패하면 Error 를 던진다. */
export async function loadAll() {
  if (cache) {
    return cache;
  }
  const [breweries, drinks, rankings, meta] = await Promise.all(FILES.map(fetchJson));
  // 소식은 없거나 못 읽어도 나머지 화면은 그대로 보여 준다.
  try {
    const loaded = await fetchJson('news');
    news = Array.isArray(loaded)
      ? loaded.filter((n) => n && typeof n === 'object' && typeof n.summary === 'string')
        .map((n) => ({ ...n, brewery_ids: Array.isArray(n.brewery_ids) ? n.brewery_ids : [] }))
      : [];
  } catch (err) {
    news = [];
  }
  if (!Array.isArray(breweries) || !Array.isArray(drinks) || !rankings || !meta) {
    throw new Error('자료 형식이 올바르지 않습니다');
  }
  breweryIndex = new Map(breweries.map((b) => [b.id, b]));
  drinkIndex = new Map(drinks.map((d) => [d.id, d]));
  byBrewery = new Map();
  drinks.forEach((d) => {
    if (!byBrewery.has(d.brewery_id)) {
      byBrewery.set(d.brewery_id, []);
    }
    byBrewery.get(d.brewery_id).push(d);
  });
  scoreIndex = new Map();
  Object.values(rankings.by_category ?? {}).forEach((cat) => {
    (cat.overall ?? []).forEach((row, i) => {
      scoreIndex.set(row.drink_id, { ...row, rank: row.rank ?? i + 1 });
    });
  });
  cache = { breweries, drinks, rankings, meta };
  return cache;
}

export function breweryById(id) {
  return breweryIndex?.get(id) ?? null;
}

export function drinkById(id) {
  return drinkIndex?.get(id) ?? null;
}

export function drinksOfBrewery(breweryId) {
  return byBrewery?.get(breweryId) ?? [];
}

/** 소식 전체(최신순). */
export function allNews() {
  return news;
}

/** 이 양조장과 연결된 소식(최신순). */
export function newsOfBrewery(breweryId) {
  return news.filter((n) => Array.isArray(n.brewery_ids) && n.brewery_ids.includes(breweryId));
}

/** 종합 순위에 든 술이면 {score, basis, parts, rank}, 아니면 null. */
export function scoreOf(drinkId) {
  return scoreIndex?.get(drinkId) ?? null;
}
