import { initApp } from './app.js';
import { myStore } from './store.js';
import { breweryById, drinksOfBrewery, loadAll, newsOfBrewery, scoreOf } from './data.js';
import {
  CATEGORY_LABELS, CATEGORY_ORDER, el, formatAbv, formatDate, getParam, newsItem, safeUrl, showMessage, textOrNone,
} from './utils.js';

function link(url) {
  const safe = safeUrl(url);
  return safe ? el('a', { href: safe, target: '_blank', rel: 'noopener noreferrer', text: safe }) : textOrNone(url);
}

function sourcesList(sources) {
  const list = el('ul', { class: 'sources' });
  (sources ?? []).forEach((s) => {
    list.append(el('li', {}, link(s.url), ` (수집 ${formatDate(s.collected)})`));
  });
  return list;
}

function favButton(id) {
  const store = myStore();
  const button = el('button', { class: 'btn toggle', type: 'button' });
  const draw = () => {
    const on = store.isFav('brewery', id);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.textContent = on ? '찜한 양조장' : '양조장 찜';
  };
  button.addEventListener('click', () => { store.toggleFav('brewery', id); draw(); });
  draw();
  return el('div', { class: 'actions' }, button);
}

function render(main, brewery) {
  const drinks = [...drinksOfBrewery(brewery.id)].sort((a, b) => {
    const sa = scoreOf(a.id)?.score ?? -1;
    const sb = scoreOf(b.id)?.score ?? -1;
    return sb - sa || a.name.localeCompare(b.name, 'ko');
  });
  document.title = `${brewery.name} — 전통주 발견`;

  const visit = brewery.visit
    ? [brewery.visit.walk_in ? '상시 방문 가능' : null, brewery.visit.reservation ? '예약 방문 가능' : null]
      .filter(Boolean).join(' · ') || '정보 없음'
    : '정보 없음';

  const facts = el('dl', { class: 'facts' },
    el('dt', { text: '지역' }), el('dd', { text: textOrNone(brewery.region) }),
    el('dt', { text: '주소' }), el('dd', { text: textOrNone(brewery.address) }),
    el('dt', { text: '전화' }), el('dd', { text: textOrNone(brewery.phone) }),
    el('dt', { text: '홈페이지' }), el('dd', {}, link(brewery.homepage)),
    el('dt', { text: '방문·체험' }), el('dd', { text: visit }),
    el('dt', { text: '소개' }), el('dd', { text: textOrNone(brewery.intro) }),
    el('dt', { text: '지정' }), el('dd', {
      text: brewery.designations?.length ? brewery.designations.map((d) => d.type).join(', ') : '없음',
    }));

  const drinkList = el('ul', { class: 'plain-list' });
  drinks.forEach((d) => {
    const score = scoreOf(d.id);
    drinkList.append(el('li', {},
      el('span', {},
        el('a', { href: `drink.html?id=${encodeURIComponent(d.id)}`, text: d.name }),
        el('span', { class: 'badge', text: CATEGORY_LABELS[d.category] ?? d.category })),
      el('span', { class: 'muted small', text: `${formatAbv(d.abv)} · ${score ? `${score.score}점` : '평가 자료 없음'}` })));
  });

  const awards = [];
  drinks.forEach((d) => (d.awards ?? []).forEach((a) => awards.push({ ...a, drink: d })));
  awards.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const awardRows = awards.map((a) => el('tr', {},
    el('td', { text: a.year ? String(a.year) : '연도 미상' }),
    el('td', { text: `${a.contest} ${a.grade}` }),
    el('td', {}, el('a', { href: `drink.html?id=${encodeURIComponent(a.drink.id)}`, text: a.drink.name }))));

  const byCat = CATEGORY_ORDER
    .map((c) => [c, drinks.filter((d) => d.category === c).length])
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${CATEGORY_LABELS[c]} ${n}`)
    .join(' · ');

  main.replaceChildren(el('div', { class: 'wrap' },
    el('a', { class: 'back', href: 'index.html', text: '← 첫 화면' }),
    el('h1', {}, brewery.name,
      brewery.is_large ? el('span', { class: 'badge', text: '대형 업체' }) : null,
      brewery.designations?.length ? el('span', { class: 'badge accent', text: '찾아가는 양조장' }) : null),
    el('p', { class: 'muted', text: `${brewery.region ?? '지역 미상'} · 술 ${drinks.length}종${byCat ? ` (${byCat})` : ''}` }),
    favButton(brewery.id),
    el('section', { class: 'card' }, el('h2', { text: '양조장 정보' }), facts),
    el('section', { class: 'card' },
      el('h2', { text: `이 양조장의 술 ${drinks.length}종` }),
      drinks.length ? drinkList : el('p', { class: 'muted', text: '아직 수집된 술이 없습니다.' })),
    el('section', { class: 'card' },
      el('h2', { text: '수상 이력' }),
      awardRows.length
        ? el('div', { class: 'table-wrap' }, el('table', {},
          el('thead', {}, el('tr', {}, el('th', { text: '연도' }), el('th', { text: '수상' }), el('th', { text: '술' }))),
          el('tbody', {}, awardRows)))
        : el('p', { class: 'muted', text: '수집된 수상 이력이 없습니다.' })),
    el('section', { class: 'card' },
      el('h2', { text: '최근 소식' }),
      newsOfBrewery(brewery.id).length
        ? el('ul', { class: 'news-list' }, newsOfBrewery(brewery.id).map((n) => newsItem(n, breweryById)))
        : el('p', { class: 'muted', text: '이 양조장과 관련해 모은 소식이 아직 없습니다.' })),
    el('section', { class: 'card' }, el('h2', { text: '자료 출처' }), sourcesList(brewery.sources))));
}

async function start() {
  initApp();
  const main = document.getElementById('main');
  try {
    await loadAll();
  } catch (err) {
    showMessage(main, '자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', true);
    return;
  }
  const brewery = breweryById(getParam('id'));
  if (!brewery) {
    showMessage(main, '찾을 수 없습니다. 주소가 바뀌었거나 없는 양조장입니다.', true);
    return;
  }
  try {
    render(main, brewery);
  } catch (err) {
    showMessage(main, '자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', true);
  }
}

start();
