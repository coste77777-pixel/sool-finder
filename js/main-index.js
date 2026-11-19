import { initTheme } from './theme.js';
import { allNews, breweryById, drinkById, drinksOfBrewery, loadAll } from './data.js';
import {
  CATEGORY_LABELS, CATEGORY_ORDER, REGION_ORDER, drinkPhoto, el, formatAbv, formatDate, getParam, newsItem, showMessage,
} from './utils.js';

const PAGE_SIZE = 20;
const NO_REGION = '지역 미상';

const state = { category: 'takju', mode: 'overall', shown: PAGE_SIZE, region: null };

function pad(n) {
  return n === null || n === undefined ? '' : String(n).padStart(2, '0');
}
let data = null;

function drinkRow(row, rankNo) {
  const drink = drinkById(row.drink_id);
  if (!drink) {
    return null;
  }
  const brewery = breweryById(drink.brewery_id);
  const nameLine = el('div', {},
    el('a', { class: 'name', href: `drink.html?id=${encodeURIComponent(drink.id)}`, text: drink.name }),
    brewery?.is_large ? el('span', { class: 'badge', text: '대형 업체' }) : null,
    (row.basis?.length ?? 0) === 1 ? el('span', { class: 'badge', text: '근거 적음' }) : null);
  const meta = el('div', { class: 'rank-meta' },
    brewery
      ? el('a', { href: `brewery.html?id=${encodeURIComponent(brewery.id)}`, text: brewery.name })
      : '양조장 정보 없음',
    ` · ${brewery?.region ?? NO_REGION} · ${formatAbv(drink.abv)}`);
  return el('li', { class: 'rank-row with-thumb' },
    el('span', { class: 'rank-no', text: pad(rankNo) }),
    drinkPhoto(drink, 'thumb'),
    el('div', { class: 'rank-main' }, nameLine, meta),
    row.discovery === undefined
      ? el('div', { class: 'score' }, row.score === undefined ? '' : `${row.score}`)
      : el('div', { class: 'score' }, `발견 ${row.discovery}점`, el('small', { text: `품질 ${row.score} · 알려진 정도 ${row.awareness}` })));
}

function renderSummary() {
  const { meta } = data;
  const stats = [
    [meta.brewery_count.toLocaleString('ko-KR'), '양조장'],
    [meta.drink_count.toLocaleString('ko-KR'), '우리술'],
    [(meta.ranked_count ?? 0).toLocaleString('ko-KR'), '순위에 오른 술'],
    [(data.rankings.hidden_breweries?.length ?? 0).toLocaleString('ko-KR'), '숨은 양조장'],
  ];
  if (meta.coverage_pct !== null && meta.coverage_pct !== undefined) {
    stats.push([`${meta.coverage_pct}%`, '면허 대비 수집률']);
  }
  document.getElementById('summary').replaceChildren(
    ...stats.map(([value, label]) => el('div', { class: 'stat' }, el('b', { text: value }), el('span', { text: label }))));
  document.getElementById('kicker').textContent = `${formatDate(meta.updated)} 갱신 · 매주 월요일`;
  document.getElementById('lead').textContent =
    `전국 양조장 ${meta.brewery_count.toLocaleString('ko-KR')}곳의 술을 품평회 수상 기록으로 줄 세우고, 실력에 비해 덜 알려진 곳을 따로 골랐습니다.`;
}

function renderNewFound() {
  const { breweries, drinks, meta } = data;
  const box = document.getElementById('new-found');
  const newBreweries = breweries.filter((b) => b.first_seen === meta.updated);
  const newDrinks = drinks.filter((d) => d.first_seen === meta.updated);
  if (newBreweries.length === breweries.length && newDrinks.length === drinks.length) {
    box.replaceChildren(el('p', { class: 'notice', text: '첫 수집입니다. 다음 갱신부터 새로 발견된 곳이 여기에 나옵니다.' }));
    return;
  }
  if (newBreweries.length === 0 && newDrinks.length === 0) {
    box.replaceChildren(el('p', { class: 'muted', text: '이번 갱신에서 새로 나타난 양조장이나 술이 없습니다.' }));
    return;
  }
  const list = el('ul', { class: 'plain-list' });
  newBreweries.slice(0, 5).forEach((b) => {
    list.append(el('li', {},
      el('a', { href: `brewery.html?id=${encodeURIComponent(b.id)}`, text: b.name }),
      el('span', { class: 'muted small', text: `새 양조장 · ${b.region ?? NO_REGION}` })));
  });
  newDrinks.slice(0, 5).forEach((d) => {
    list.append(el('li', {},
      el('a', { href: `drink.html?id=${encodeURIComponent(d.id)}`, text: d.name }),
      el('span', { class: 'muted small', text: `새 술 · ${CATEGORY_LABELS[d.category] ?? ''}` })));
  });
  box.replaceChildren(
    el('p', { class: 'muted small', text: `새 양조장 ${newBreweries.length}곳 · 새 술 ${newDrinks.length}종` }),
    list);
}

const NEWS_PAGE = 5;
let newsShown = NEWS_PAGE;

function renderNews() {
  const box = document.getElementById('news');
  const items = allNews();
  if (!items.length) {
    box.replaceChildren(el('p', { class: 'muted', text: '아직 모은 소식이 없습니다.' }));
    return;
  }
  const list = el('ul', { class: 'news-list' }, items.slice(0, newsShown).map((n) => newsItem(n, breweryById)));
  const children = [list];
  if (items.length > newsShown) {
    const more = el('button', { class: 'btn more', type: 'button', text: `소식 더 보기 (${newsShown}/${items.length})` });
    more.addEventListener('click', () => { newsShown += NEWS_PAGE; renderNews(); });
    children.push(more);
  }
  children.push(el('p', { class: 'muted small', text: '소식은 기사와 보도자료를 읽고 짧게 직접 요약한 것입니다. 자세한 내용은 출처 링크에서 확인하세요.' }));
  box.replaceChildren(...children);
}

function renderHiddenBreweries() {
  const { rankings } = data;
  const box = document.getElementById('hidden-breweries');
  if (rankings.hidden_breweries_status !== 'ok' || !rankings.hidden_breweries?.length) {
    box.replaceChildren(
      el('p', { class: 'notice', text: '검색 문서 수 자료를 받으면 제공합니다.' }),
      el('p', { class: 'muted small', text: '"덜 알려진 정도"는 다음 검색에서 양조장 이름으로 찾은 웹문서·카페 글 수로 계산하는데, 지금은 그 자료를 아직 받지 못했습니다.' }));
    return;
  }
  const list = el('ol', { class: 'rank-list' });
  rankings.hidden_breweries.slice(0, 10).forEach((row, i) => {
    const b = breweryById(row.brewery_id);
    if (!b) {
      return;
    }
    const awareness = Math.max(0, Math.min(100, Number(row.awareness) || 0));
    list.append(el('li', { class: 'rank-row' },
      el('span', { class: 'rank-no', text: pad(i + 1) }),
      el('div', { class: 'rank-main' },
        el('a', { class: 'name', href: `brewery.html?id=${encodeURIComponent(b.id)}`, text: b.name }),
        el('div', { class: 'rank-meta', text: `${b.region ?? NO_REGION} · 순위에 든 술 ${row.drink_count ?? 0}종 · 품질 ${row.score}` }),
        row.awareness === undefined ? null
          : el('span', { class: 'aware', title: `알려진 정도 ${row.awareness}`, 'aria-label': `알려진 정도 ${row.awareness}` },
            el('i', { style: `width:${awareness}%` }))),
      el('div', { class: 'score', text: String(row.discovery ?? row.score) })));
  });
  box.replaceChildren(list,
    el('p', { class: 'muted small credit', text: '숫자는 발견 점수(품질과 덜 알려진 정도의 평균), 막대는 알려진 정도입니다. 막대가 짧을수록 덜 알려진 곳입니다.' }));
}

function makeTabs(container, entries, selected, onSelect) {
  container.replaceChildren(...entries.map(([key, label]) => {
    const [text, count] = Array.isArray(label) ? label : [label, null];
    const button = el('button', {
      class: 'tab', type: 'button', role: 'tab', 'aria-selected': key === selected ? 'true' : 'false',
      tabindex: key === selected ? '0' : '-1', 'data-key': key,
    }, text, count === null ? null : el('span', { class: 'count', text: String(count) }));
    button.addEventListener('click', () => onSelect(key));
    return button;
  }));
  container.onkeydown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    const keys = entries.map(([key]) => key);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = keys[(keys.indexOf(selected) + step + keys.length) % keys.length];
    onSelect(next);
    container.querySelector(`[data-key="${next}"]`)?.focus();
    event.preventDefault();
  };
}

function renderRanking() {
  const { rankings } = data;
  const cat = rankings.by_category?.[state.category] ?? { overall: [], hidden: [] };
  makeTabs(document.getElementById('cat-tabs'),
    CATEGORY_ORDER.map((key) => [key, [CATEGORY_LABELS[key], rankings.by_category?.[key]?.overall?.length ?? 0]]),
    state.category,
    (key) => { state.category = key; state.shown = PAGE_SIZE; renderRanking(); });
  makeTabs(document.getElementById('mode-tabs'),
    [['overall', '종합 순위'], ['hidden', '숨은 명주 순위']],
    state.mode,
    (key) => { state.mode = key; state.shown = PAGE_SIZE; renderRanking(); });

  const panel = document.getElementById('rank-panel');
  if (state.mode === 'hidden' && (cat.hidden_status !== 'ok' || !cat.hidden?.length)) {
    panel.replaceChildren(
      el('p', { class: 'notice', text: '숨은 명주 순위는 검색 문서 수 자료를 받으면 제공합니다.' }));
    return;
  }
  const rows = state.mode === 'hidden' ? cat.hidden : cat.overall;
  if (!rows?.length) {
    panel.replaceChildren(el('p', { class: 'muted', text: '이 분야에는 아직 순위에 오른 술이 없습니다.' }));
    return;
  }
  const list = el('ol', { class: 'rank-list featured' });
  rows.slice(0, state.shown).forEach((row, i) => {
    const item = drinkRow(row, row.rank ?? i + 1);
    if (item) {
      list.append(item);
    }
  });
  const children = [list];
  const photoCredit = data.drinks.some((d) => d.image_url) ? '사진: 더술닷컴 · ' : '';
  const credit = el('p', { class: 'muted small credit', text: state.mode === 'hidden'
    ? photoCredit + '발견 점수는 품질 점수와 "덜 알려진 정도"의 평균입니다. 품질 40점 이상이면서 분야 중간 이상이고, 알려진 정도가 50 이하인 술만 넣었습니다. 대형 업체는 뺐습니다.'
    : photoCredit + '점수가 같으면 같은 순위로 표시합니다.' });
  if (rows.length > state.shown) {
    const more = el('button', { class: 'btn more', type: 'button', text: `더 보기 (${state.shown}/${rows.length})` });
    more.addEventListener('click', () => { state.shown += PAGE_SIZE; renderRanking(); });
    children.push(more);
  }
  children.push(credit);
  panel.replaceChildren(...children);
}

function breweriesIn(region) {
  return data.breweries
    .filter((b) => (b.region ?? NO_REGION) === region)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

function renderRegions() {
  const counts = new Map();
  data.breweries.forEach((b) => {
    const key = b.region ?? NO_REGION;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const regions = [...REGION_ORDER];
  if (counts.has(NO_REGION)) {
    regions.push(NO_REGION);
  }
  document.getElementById('region-grid').replaceChildren(...regions.map((region) => {
    const button = el('button', {
      class: 'region-btn', type: 'button', 'aria-pressed': state.region === region ? 'true' : 'false',
    }, el('span', { text: region }), el('small', { text: `${counts.get(region) ?? 0}곳` }));
    button.addEventListener('click', () => {
      state.region = state.region === region ? null : region;
      const url = new URL(window.location.href);
      if (state.region) {
        url.searchParams.set('region', state.region);
      } else {
        url.searchParams.delete('region');
      }
      window.history.replaceState(null, '', url);
      renderRegions();
    });
    return button;
  }));

  const result = document.getElementById('region-result');
  if (!state.region) {
    result.replaceChildren();
    return;
  }
  const found = breweriesIn(state.region);
  if (found.length === 0) {
    result.replaceChildren(el('p', { class: 'muted', text: `${state.region}에는 아직 수집된 양조장이 없습니다.` }));
    return;
  }
  const list = el('ul', { class: 'plain-list' });
  found.forEach((b) => {
    list.append(el('li', {},
      el('span', {},
        el('a', { href: `brewery.html?id=${encodeURIComponent(b.id)}`, text: b.name }),
        b.is_large ? el('span', { class: 'badge', text: '대형 업체' }) : null,
        b.designations?.length ? el('span', { class: 'badge accent', text: '찾아가는 양조장' }) : null),
      el('span', { class: 'muted small', text: `술 ${drinksOfBrewery(b.id).length}종` })));
  });
  result.replaceChildren(el('h3', { text: `${state.region} 양조장 ${found.length}곳` }), list);
}

function renderSearch(query) {
  const box = document.getElementById('search-results');
  const q = query.trim().toLowerCase();
  if (!q) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  const breweries = data.breweries.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 10);
  const drinks = data.drinks.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 20);
  box.hidden = false;
  if (breweries.length === 0 && drinks.length === 0) {
    box.replaceChildren(el('p', { class: 'muted', text: `"${query.trim()}"에 맞는 양조장이나 술이 없습니다.` }));
    return;
  }
  const list = el('ul', { class: 'plain-list' });
  breweries.forEach((b) => {
    list.append(el('li', {},
      el('a', { href: `brewery.html?id=${encodeURIComponent(b.id)}`, text: b.name }),
      el('span', { class: 'muted small', text: `양조장 · ${b.region ?? NO_REGION}` })));
  });
  drinks.forEach((d) => {
    const b = breweryById(d.brewery_id);
    list.append(el('li', {},
      el('a', { href: `drink.html?id=${encodeURIComponent(d.id)}`, text: d.name }),
      el('span', { class: 'muted small', text: `${CATEGORY_LABELS[d.category] ?? ''} · ${b?.name ?? ''}` })));
  });
  box.replaceChildren(el('h2', { text: '검색 결과' }), list);
}

async function start() {
  initTheme();
  const main = document.getElementById('main');
  try {
    data = await loadAll();
  } catch (err) {
    showMessage(main, '자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.');
    return;
  }
  const region = getParam('region');
  if (region && (REGION_ORDER.includes(region) || region === NO_REGION)) {
    state.region = region;
  }
  try {
    renderSummary();
    renderNewFound();
    renderNews();
    renderHiddenBreweries();
    renderRanking();
    renderRegions();
  } catch (err) {
    showMessage(main, '자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.');
    return;
  }
  let timer = null;
  document.getElementById('search').addEventListener('input', (event) => {
    window.clearTimeout(timer);
    const value = event.target.value;
    timer = window.setTimeout(() => renderSearch(value), 150);
  });
}

start();
