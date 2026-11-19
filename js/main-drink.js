import { initTheme } from './theme.js';
import { breweryById, drinkById, loadAll, scoreOf } from './data.js';
import {
  BASIS_LABELS, CATEGORY_LABELS, drinkPhoto, el, formatAbv, formatDate, getParam, safeUrl, showMessage, textOrNone,
} from './utils.js';

function link(url) {
  const safe = safeUrl(url);
  return safe ? el('a', { href: safe, target: '_blank', rel: 'noopener noreferrer', text: safe }) : textOrNone(url);
}

function scoreCard(drink, score, weights) {
  if (!score) {
    return el('section', { class: 'card' },
      el('h2', { text: '점수' }),
      el('p', { class: 'notice', text: '평가 자료 없음' }),
      el('p', { class: 'muted small', text: '수집된 수상 이력이 없어 순위에 넣지 않았습니다. 좋지 않은 술이라는 뜻이 아닙니다.' }));
  }
  const rows = Object.keys(weights).map((key) => {
    const value = score.parts?.[key];
    const has = value !== null && value !== undefined;
    return el('tr', {},
      el('td', { text: BASIS_LABELS[key] ?? key }),
      el('td', { text: `${weights[key]}` }),
      el('td', {}, has ? `${value}점` : '자료 없음',
        has ? el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: `width:${Math.max(0, Math.min(100, value))}%` })) : null));
  });
  return el('section', { class: 'card' },
    el('h2', { text: '점수와 근거' }),
    el('p', {},
      el('b', { text: `${score.score}점` }),
      ` · ${CATEGORY_LABELS[drink.category] ?? ''} 종합 ${score.rank}위`,
      score.basis?.length === 1 ? el('span', { class: 'badge', text: '근거 적음' }) : null),
    el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, el('th', { text: '항목' }), el('th', { text: '비중' }), el('th', { text: '점수' }))),
      el('tbody', {}, rows))),
    el('p', { class: 'muted small' },
      `근거 ${score.basis?.length ?? 0}가지로 계산했습니다. 자료가 없는 항목은 빼고 나머지 비중으로 환산합니다. `,
      el('a', { href: 'about.html', text: '계산 방법 보기' })));
}

function buyCard(drink, brewery) {
  const homepage = safeUrl(brewery?.homepage);
  const query = `${drink.name} ${brewery?.short_name ?? brewery?.name ?? ''}`.trim();
  const items = [];
  if (homepage) {
    items.push(el('li', {},
      el('a', { href: homepage, target: '_blank', rel: 'noopener noreferrer', text: '양조장 홈페이지' }),
      el('span', { class: 'muted small', text: brewery.name })));
  }
  items.push(el('li', {},
    el('a', {
      href: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(query)}`,
      target: '_blank', rel: 'noopener noreferrer', text: '네이버쇼핑에서 이 술 찾기',
    }),
    el('span', { class: 'muted small', text: `검색어: ${query}` })));
  items.push(el('li', {},
    el('a', {
      href: 'https://thesool.com/front/publication/M000000055/list.do',
      target: '_blank', rel: 'noopener noreferrer', text: '전통주 온라인 판매처 목록',
    }),
    el('span', { class: 'muted small', text: '더술닷컴 안내' })));
  return el('section', { class: 'card' },
    el('h2', { text: '구매처 안내' }),
    el('ul', { class: 'plain-list' }, items),
    brewery ? el('p', { class: 'muted small', text: `전화 문의: ${brewery.name} ${textOrNone(brewery.phone)}` }) : null,
    el('p', { class: 'muted small', text: '가격은 싣지 않습니다. 가격을 받아 올 수 있는 공개 출처가 없어, 판매처에서 직접 확인하도록 링크만 안내합니다. 링크는 다른 사이트로 이동합니다.' }));
}

function render(main, drink, rankings) {
  const brewery = breweryById(drink.brewery_id);
  const score = scoreOf(drink.id);
  document.title = `${drink.name} — 전통주 발견`;

  const facts = el('dl', { class: 'facts' },
    el('dt', { text: '분야' }), el('dd', { text: CATEGORY_LABELS[drink.category] ?? textOrNone(drink.category) }),
    el('dt', { text: '세부 종류' }), el('dd', { text: textOrNone(drink.type_text) }),
    el('dt', { text: '도수' }), el('dd', { text: drink.abv === null || drink.abv === undefined ? '정보 없음' : formatAbv(drink.abv) }),
    el('dt', { text: '용량' }), el('dd', { text: textOrNone(drink.volume_text ?? (drink.volume_ml ? `${drink.volume_ml}ml` : null)) }),
    el('dt', { text: '원재료' }), el('dd', { text: textOrNone(drink.ingredients) }),
    el('dt', { text: '양조장' }), el('dd', {},
      brewery ? el('a', { href: `brewery.html?id=${encodeURIComponent(brewery.id)}`, text: brewery.name }) : '정보 없음',
      brewery?.is_large ? el('span', { class: 'badge', text: '대형 업체' }) : null,
      brewery ? ` · ${brewery.region ?? '지역 미상'}` : ''));

  const awards = [...(drink.awards ?? [])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const awardBlock = awards.length
    ? el('ul', { class: 'plain-list' }, awards.map((a) => el('li', {},
      el('span', { text: `${a.contest} ${a.grade}` }),
      el('span', { class: 'muted small', text: a.year ? `${a.year}년` : '연도 미상' }))))
    : el('p', { class: 'muted', text: drink.award_mark ? '품평회 수상 표시는 있으나 연도와 등급은 수집되지 않았습니다.' : '수집된 수상 이력이 없습니다.' });

  const sources = el('ul', { class: 'sources' });
  (drink.sources ?? []).forEach((s) => sources.append(el('li', {}, link(s.url), ` (수집 ${formatDate(s.collected)})`)));

  main.replaceChildren(el('div', { class: 'wrap' },
    el('a', { class: 'back', href: 'index.html', text: '← 첫 화면' }),
    el('h1', { text: drink.name }),
    el('p', { class: 'muted', text: `${CATEGORY_LABELS[drink.category] ?? ''} · ${formatAbv(drink.abv)} · ${brewery?.name ?? '양조장 정보 없음'}` }),
    scoreCard(drink, score, rankings.weights ?? {}),
    el('section', { class: 'card' },
      el('h2', { text: '술 정보' }),
      safeUrl(drink.image_url)
        ? el('figure', { class: 'photo' }, drinkPhoto(drink, 'photo-frame'), el('figcaption', { class: 'muted small', text: `사진: ${drink.image_credit ?? '더술닷컴'}` }))
        : null,
      facts,
      drink.abv === null && !drink.image_url
        ? el('p', { class: 'muted small', text: '품평회 수상작 명단에서 옮긴 술이라 도수·용량·원재료·사진 정보가 아직 없습니다. 자세한 정보는 양조장에 확인해 주세요.' })
        : null),
    el('section', { class: 'card' },
      el('h2', { text: '수상 이력' }),
      awardBlock,
      drink.notes?.length ? el('h3', { text: '기타 이력' }) : null,
      drink.notes?.length ? el('ul', {}, drink.notes.map((n) => el('li', { class: 'small', text: n }))) : null,
      drink.notes?.length ? el('p', { class: 'muted small', text: '기타 이력은 점수에 넣지 않습니다.' }) : null),
    buyCard(drink, brewery),
    el('section', { class: 'card' }, el('h2', { text: '자료 출처' }), sources)));
}

async function start() {
  initTheme();
  const main = document.getElementById('main');
  let data = null;
  try {
    data = await loadAll();
  } catch (err) {
    showMessage(main, '자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', true);
    return;
  }
  const drink = drinkById(getParam('id'));
  if (!drink) {
    showMessage(main, '찾을 수 없습니다. 주소가 바뀌었거나 없는 술입니다.', true);
    return;
  }
  try {
    render(main, drink, data.rankings);
  } catch (err) {
    showMessage(main, '자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', true);
  }
}

start();
