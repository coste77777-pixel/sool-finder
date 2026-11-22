import { initApp } from './app.js';
import { drinkById, loadAll } from './data.js';
import { BASIS_LABELS, CATEGORY_LABELS, el, formatDate, showMessage } from './utils.js';

const SOURCES = [
  ['더술닷컴 우리술 찾기 (농림축산식품부·aT)', '술 이름, 양조장, 주소, 도수, 용량, 원재료, 수상내역', '사용 중'],
  ['더술닷컴 찾아가는 양조장', '정부 지정 우수 양조장, 방문 가능 여부', '사용 중'],
  ['농림축산식품부 보도자료 (우리술 품평회 결과)', '2021~2026년 수상작 99건. 2022년은 더술닷컴의 수상작 카탈로그', '사용 중'],
  ['식약처 주류제조업 등록 업소', '전국 양조장 이름과 주소 (전수에 가장 가까운 목록)', '인증키 준비 후 추가'],
  ['국세청 주류 제조면허 현황', '지역·주종별 면허 개수 (수집률 계산 기준)', '준비 중'],
  ['다음 검색 API (카카오, 공식)', '술·양조장 이름의 웹문서·블로그·카페 글 수 (글 내용은 쓰지 않음)', '숨은 순위에 사용. 건수만 저장하고 매주 다시 조회'],
  ['네이버 검색 API', '—', '쇼핑 검색 종료, 약관상 저장·가공 금지로 쓰지 않음'],
  ['술담화·홈술닷컴·술마켓', '—', '약관이나 수집 차단 설정 때문에 수집하지 않음'],
  ['뉴스·보도자료 (웹 검색)', '수상, 신제품, 지정, 행사 소식. 기사를 읽고 짧게 직접 요약하고 원문 링크를 붙임', '사용 중'],
];

const LIMITS = [
  '전국의 모든 양조장을 담지는 못했습니다. 지금은 더술닷컴에 등록된 양조장과 술만 실려 있습니다.',
  '가격은 싣지 않습니다. 가격을 받아 올 수 있는 공개 출처가 없어 술 화면에서 구매처 링크만 안내합니다.',
  '구매자 평점도 수집해도 되는 공개 출처가 없어 쓰지 않습니다. 그래서 순위에는 수상 이력이 있는 술만 오릅니다.',
  '2020년까지의 수상내역은 더술닷컴에 적힌 내용이고, 2021년부터는 우리술 품평회 수상작 명단을 따로 옮겼습니다. 다른 대회의 최근 수상은 빠져 있을 수 있습니다.',
  '수상작 명단에서 새로 옮긴 술은 도수·용량·사진 정보가 없습니다. 사진이 없는 술은 분야별 병 그림으로 대신 보여 줍니다. 명단의 제품명이 더술닷컴의 이름과 조금 다르면 같은 술인지 사람이 판단해 이었습니다.',
  '수상내역은 더술닷컴에 글로 적힌 것을 프로그램이 읽은 결과라, 드물게 대회 이름이나 등급을 잘못 읽을 수 있습니다.',
];

function table(headers, rows) {
  return el('div', { class: 'table-wrap' }, el('table', {},
    el('thead', {}, el('tr', {}, headers.map((h) => el('th', { text: h })))),
    el('tbody', {}, rows.map((cells) => el('tr', {}, cells.map((c) => el('td', {}, c)))))));
}

function render(main, data) {
  const { rankings, meta } = data;
  const weights = rankings.weights ?? {};
  const unranked = (rankings.unranked ?? []).map(drinkById).filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const shown = unranked.slice(0, 200);
  const unrankedList = el('ul', { class: 'plain-list' });
  shown.forEach((d) => unrankedList.append(el('li', {},
    el('a', { href: `drink.html?id=${encodeURIComponent(d.id)}`, text: d.name }),
    el('span', { class: 'muted small', text: CATEGORY_LABELS[d.category] ?? '' }))));

  main.replaceChildren(el('div', { class: 'wrap' },
    el('a', { class: 'back', href: 'index.html', text: '← 첫 화면' }),
    el('h1', { text: '순위 기준과 자료 출처' }),
    el('p', { class: 'muted', text: `최근 갱신 ${formatDate(meta.updated)} · 양조장 ${meta.brewery_count}곳 · 술 ${meta.drink_count}종` }),

    el('section', { class: 'card' },
      el('h2', { text: '점수는 이렇게 계산합니다' }),
      el('p', { text: '술마다 0~100점의 품질 점수를 매기고, 분야 안에서 점수가 높은 순서로 줄을 세웁니다. 점수가 같으면 같은 순위입니다.' }),
      el('p', { text: '그 술 자체의 근거(지금은 수상 이력)가 있는 술만 순위에 넣습니다. 양조장이 "찾아가는 양조장"이라는 것만으로는 순위에 넣지 않고, 순위에 든 술의 가점으로만 씁니다. 만찬주 선정·표창 같은 이력은 수상으로 세지 않고 술 화면의 "기타 이력"에 따로 적습니다.' }),
      table(['항목', '비중', '내용'], Object.keys(weights).map((key) => [
        BASIS_LABELS[key] ?? key,
        String(weights[key]),
        {
          award: '수상 등급 × 최근성 × 대회 무게. 등급: 대상·대통령상 100, 최우수상·금상 80, 우수상·은상 60, 장려상·동상·입선 40. 최근성: 한 해 지날 때마다 5%씩 줄고 40%까지만 줄어듭니다(연도를 모르면 40%). 대회 무게: 대한민국 우리술 품평회 1.0, 그 밖의 주류 대회 0.8, 공모전·디자인상 0.5. 가장 높은 1건을 기준으로, 수상이 더 있으면 1건당 5점씩 최대 15점을 더합니다. 품평회 수상 표시만 있고 연도·등급이 적혀 있지 않으면 30점.',
          rating: '쇼핑몰 구매자 평점. 수집해도 되는 공개 출처가 없어 지금은 계산에서 빠져 있습니다.',
          designation: '양조장이 정부 지정 "찾아가는 양조장"이면 100점.',
        }[key] ?? '',
      ])),
      el('h3', { text: '자료가 없는 항목' }),
      el('p', { text: '자료가 없는 항목은 0점으로 두지 않고 계산에서 뺀 뒤, 나머지 항목의 비중을 100으로 환산합니다. 근거가 한 가지뿐인 술에는 "근거 적음" 표시를 붙입니다.' }),
      el('h3', { text: '숨은 명주 순위' }),
      el('p', { text: '"평가는 좋은데 덜 알려진 술"을 찾기 위한 순위입니다. 발견 점수 = (품질 점수 + 덜 알려진 정도) ÷ 2 이고, 덜 알려진 정도 = 100 − 알려진 정도입니다.' }),
      el('p', { text: '세 조건을 모두 채운 술만 넣습니다. ① 품질 점수가 40점 이상이면서 그 분야 순위권의 중간 이상 ② 알려진 정도가 50 이하 ③ 대형 업체의 술이 아님.' }),
      el('p', { text: '"알려진 정도"(0~100)는 다음 검색에서 "술 이름 + 양조장 이름"으로 찾았을 때 나오는 웹문서·블로그·카페 글 수가, 같은 분야 순위권 술 가운데 어디쯤인지(백분위)를 평균한 값입니다. 글 내용은 쓰지 않고 건수만 씁니다. 건수는 검색 서비스 사정에 따라 달라지는 어림값이고, 이름이 흔한 낱말인 술은 실제보다 많이 잡힐 수 있어 순서는 참고용으로 봐 주세요.' }),
      el('p', { text: '숨은 양조장은 순위에 든 술이 있고 대형 업체가 아닌 양조장이 대상입니다. 품질은 그 술들 점수의 평균이고, 알려진 정도는 "양조장 이름" 전통주 로 찾은 웹문서·카페 글 수의 백분위입니다(블로그 글 수는 이름이 흔한 낱말이면 부풀려져서 쓰지 않습니다). 조건은 술과 같습니다.' }),
      el('h3', { text: '구매처' }),
      el('p', { text: '술 화면에서 양조장 홈페이지, 네이버쇼핑 검색, 더술닷컴의 온라인 판매처 목록으로 가는 링크를 안내합니다. 가격은 싣지 않습니다.' }),
      el('h3', { text: '대형 업체 기준' }),
      el('p', { text: meta.large_maker_criteria ?? '정보 없음' })),

    el('section', { class: 'card' },
      el('h2', { text: '자료 출처' }),
      table(['출처', '얻는 것', '상태'], SOURCES),
      el('p', { class: 'muted small', text: '각 양조장과 술 화면 아래에 그 항목의 출처 주소와 수집 날짜가 적혀 있습니다. 리뷰 글과 사진은 가져오지 않고 숫자와 링크만 저장합니다.' })),

    el('section', { class: 'card' },
      el('h2', { text: '알려진 한계' }),
      el('ul', {}, LIMITS.concat(data.drinks.some((d) => d.image_url)
        ? ['제품 사진은 더술닷컴의 사진을 그대로 불러와 보여 줍니다. 더술닷컴에 사진이 없는 술 일부는 그 양조장 홈페이지의 제품 사진을 불러오고, 술 화면에 출처를 적습니다. 사진 파일을 따로 저장하지 않습니다.']
        : ['제품 사진은 사용 허락을 확인하지 못해 싣지 않습니다. 술 화면의 출처 링크에서 더술닷컴의 사진을 볼 수 있습니다.']).map((t) => el('li', { text: t })))),

    el('section', { class: 'card' },
      el('h2', { text: `평가 자료 없음 ${unranked.length}종` }),
      el('p', { class: 'muted small', text: '수집된 수상 이력이 없어 순위에 넣지 않은 술입니다. 좋지 않은 술이라는 뜻이 아닙니다.' }),
      unranked.length ? unrankedList : el('p', { class: 'muted', text: '해당하는 술이 없습니다.' }),
      unranked.length > shown.length
        ? el('p', { class: 'muted small', text: `이름순으로 처음 ${shown.length}종만 보여 줍니다. 나머지는 첫 화면의 검색이나 지역으로 찾을 수 있습니다.` })
        : null)));
}

async function start() {
  initApp();
  const main = document.getElementById('main');
  try {
    render(main, await loadAll());
  } catch (err) {
    showMessage(main, '자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', true);
  }
}

start();
