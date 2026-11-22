import { initApp } from './app.js';
import { breweryById, drinkById, loadAll } from './data.js';
import { myStore, today } from './store.js';
import { CATEGORY_LABELS, drinkPhoto, el, formatAbv, formatDate, showMessage } from './utils.js';

const store = myStore();
let status = null;

function say(text) {
  if (status) {
    status.textContent = text;
  }
}

function stars(rating) {
  return rating ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : '별점 없음';
}

function drinkLine(drink, extra) {
  const brewery = breweryById(drink.brewery_id);
  return el('li', { class: 'rank-row with-thumb my-row' },
    drinkPhoto(drink, 'thumb'),
    el('div', { class: 'rank-main' },
      el('a', { class: 'name', href: `drink.html?id=${encodeURIComponent(drink.id)}`, text: drink.name }),
      el('div', { class: 'rank-meta', text: `${brewery?.name ?? '양조장 정보 없음'} · ${CATEGORY_LABELS[drink.category] ?? ''} · ${formatAbv(drink.abv)}` }),
      extra ?? null));
}

function missingLine(count) {
  return count ? el('p', { class: 'muted small', text: `자료에서 사라진 항목 ${count}건은 표시하지 않았습니다.` }) : null;
}

function favDrinks() {
  const ids = store.listFav('drink');
  const drinks = ids.map(drinkById).filter(Boolean);
  return el('section', { class: 'card', 'aria-labelledby': 'h-fav-drinks' },
    el('h2', { id: 'h-fav-drinks', text: `찜한 술 ${drinks.length}` }),
    drinks.length
      ? el('ul', { class: 'rank-list' }, drinks.map((d) => drinkLine(d)))
      : el('p', { class: 'muted', text: '아직 찜한 술이 없습니다. 술 화면에서 "찜"을 눌러 모아 보세요.' }),
    missingLine(ids.length - drinks.length));
}

function favBreweries() {
  const ids = store.listFav('brewery');
  const breweries = ids.map(breweryById).filter(Boolean);
  return el('section', { class: 'card', 'aria-labelledby': 'h-fav-breweries' },
    el('h2', { id: 'h-fav-breweries', text: `찜한 양조장 ${breweries.length}` }),
    breweries.length
      ? el('ul', { class: 'plain-list' }, breweries.map((b) => el('li', {},
        el('a', { href: `brewery.html?id=${encodeURIComponent(b.id)}`, text: b.name }),
        el('span', { class: 'muted small', text: b.region ?? '지역 미상' }))))
      : el('p', { class: 'muted', text: '아직 찜한 양조장이 없습니다.' }),
    missingLine(ids.length - breweries.length));
}

function tasted(rerender) {
  const records = store.listTasted();
  const rows = records.map((r) => [r, drinkById(r.id)]).filter(([, d]) => d);
  // 자료가 바뀌어 지금은 찾을 수 없는 술의 기록도 버리지 않고 보여 준다.
  const orphans = records.filter((r) => !drinkById(r.id));
  const note = (r) => el('div', { class: 'my-note' },
    el('span', { class: 'stars', 'aria-label': r.rating ? `별점 ${r.rating}점` : '별점 없음', text: stars(r.rating) }),
    r.date ? el('span', { class: 'muted small', text: formatDate(r.date) }) : null,
    r.memo ? el('p', { class: 'memo', text: r.memo }) : null);
  return el('section', { class: 'card', 'aria-labelledby': 'h-tasted' },
    el('h2', { id: 'h-tasted', text: `마셔 본 술 ${records.length}` }),
    rows.length
      ? el('ul', { class: 'rank-list' }, rows.map(([r, d]) => drinkLine(d, note(r))))
      : null,
    records.length
      ? null
      : el('p', { class: 'muted', text: '아직 기록이 없습니다. 술 화면에서 "마셔 봤어요"를 눌러 별점과 한 줄 메모를 남겨 보세요.' }),
    orphans.length ? el('h3', { text: '지금은 자료에 없는 술' }) : null,
    orphans.length
      ? el('ul', { class: 'plain-list' }, orphans.map((r) => {
        const remove = el('button', { class: 'btn', type: 'button', text: '지우기', 'aria-label': `${r.name || '이름 없는 기록'} 지우기` });
        remove.addEventListener('click', () => {
          store.removeTasted(r.id);
          rerender();
          say('기록을 지웠습니다.');
        });
        return el('li', {}, el('div', {}, el('strong', { text: r.name || '이름을 알 수 없는 술' }), note(r)), remove);
      }))
      : null);
}

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tools(rerender) {
  const exportBtn = el('button', { class: 'btn', type: 'button', text: '파일로 내보내기' });
  const importInput = el('input', { type: 'file', accept: 'application/json,.json', id: 'import-file', class: 'visually-hidden' });
  const importLabel = el('label', { class: 'btn', for: 'import-file', text: '파일에서 불러오기' });
  const clearBtn = el('button', { class: 'btn', type: 'button', text: '기록 모두 지우기' });
  status = el('p', { class: 'muted small', role: 'status', 'aria-live': 'polite' });

  exportBtn.addEventListener('click', () => {
    download(store.exportData(), `전통주발견-내술장-${today()}.json`);
    say('내보냈습니다. 받은 파일을 새 폰에서 "파일에서 불러오기"로 열면 됩니다.');
  });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) {
      return;
    }
    try {
      if (file.size > 2_000_000) {
        throw new Error('파일이 너무 큽니다');
      }
      const result = store.importData(await file.text());
      rerender();
      say(`불러왔습니다: 찜한 술 ${result.favDrinks}, 찜한 양조장 ${result.favBreweries}, 마셔 본 술 ${result.tasted}.`);
    } catch (err) {
      say('불러오지 못했습니다. 전통주 발견에서 내보낸 파일인지 확인해 주세요.');
    }
  });
  let armed = false;
  clearBtn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      clearBtn.textContent = '정말 지울까요? 한 번 더 누르면 지웁니다';
      say('지우면 되돌릴 수 없습니다. 먼저 내보내 두는 것을 권합니다.');
      return;
    }
    store.clearRecords();
    rerender();
    say('찜과 기록을 모두 지웠습니다.');
  });

  return el('section', { class: 'card', 'aria-labelledby': 'h-tools' },
    el('h2', { id: 'h-tools', text: '기록 옮기기' }),
    el('p', { class: 'muted small', text: '찜과 기록은 이 기기에만 저장되고 어디로도 보내지 않습니다. 폰을 바꾸거나 브라우저의 사이트 데이터를 지우면 사라지니, 그 전에 파일로 내보내 두세요.' }),
    el('div', { class: 'actions' }, exportBtn, importInput, importLabel, clearBtn),
    status);
}

function render(main) {
  const rerender = () => {
    const note = status?.textContent ?? '';
    render(main);
    say(note);
  };
  main.replaceChildren(el('div', { class: 'wrap' },
    el('h1', { class: 'detail-title', text: '내 술장' }),
    el('p', { class: 'muted', text: '찜한 술과 양조장, 마셔 본 술을 모아 둔 곳입니다.' }),
    tasted(rerender),
    favDrinks(),
    favBreweries(),
    tools(rerender)));
}

async function start() {
  initApp('my');
  const main = document.getElementById('main');
  try {
    await loadAll();
    render(main);
  } catch (err) {
    showMessage(main, '자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', true);
  }
}

start();
