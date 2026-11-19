export const CATEGORY_LABELS = {
  takju: '탁주',
  yakju: '약주·청주',
  spirits: '증류주',
  fruit: '과실주',
  etc: '기타주류',
};

export const CATEGORY_ORDER = ['takju', 'yakju', 'spirits', 'fruit', 'etc'];

export const REGION_ORDER = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

export const NEWS_KIND_LABELS = {
  award: '수상',
  new_product: '신제품',
  opening: '개업·이전',
  designation: '지정·선정',
  event: '행사',
  other: '기타',
};

export const BASIS_LABELS = {
  award: '수상 이력',
  rating: '구매자 평점',
  designation: '전문 지정',
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function textOrNone(value) {
  if (value === null || value === undefined || value === '') {
    return '정보 없음';
  }
  return String(value);
}

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) {
    return '정보 없음';
  }
  return `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.`;
}

export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function formatAbv(abv) {
  return abv === null || abv === undefined ? '도수 정보 없음' : `${abv}도`;
}

/** http(s) 주소만 링크로 쓴다. 그 밖의 값은 null. */
export function safeUrl(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const url = value.trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

/** 태그와 속성·자식으로 요소를 만든다. 문자열 자식은 textContent 로 들어간다. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) {
      return;
    }
    if (key === 'class') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else {
      node.setAttribute(key, value === true ? '' : value);
    }
  });
  children.flat().forEach((child) => {
    if (child === null || child === undefined || child === false) {
      return;
    }
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

export function showMessage(main, message, withHomeLink = false) {
  main.replaceChildren(
    el('div', { class: 'wrap' },
      el('div', { class: 'card' },
        el('p', { class: 'notice', text: message }),
        withHomeLink ? el('p', {}, el('a', { class: 'back', href: 'index.html', text: '← 첫 화면으로' })) : null)));
}

/** 술 사진 요소. 주소가 없거나 불러오지 못하면 자리를 비워 둔다. */
export function drinkPhoto(drink, className) {
  const url = safeUrl(drink?.image_url);
  const box = el('span', { class: className });
  if (!url) {
    return box;
  }
  const img = el('img', {
    src: url, alt: `${drink.name} 사진`, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer',
  });
  img.addEventListener('error', () => img.remove());
  box.append(img);
  return box;
}

/** 소식 한 건. 요약은 직접 쓴 짧은 글이고, 원문은 출처 링크로 연다. */
export function newsItem(item, breweryLookup) {
  const url = safeUrl(item.url);
  const linked = (item.brewery_ids ?? []).map((id) => breweryLookup?.(id)).filter(Boolean);
  return el('li', { class: 'news-item' },
    el('div', { class: 'news-head' },
      el('span', { class: 'badge accent', text: NEWS_KIND_LABELS[item.kind] ?? '소식' }),
      el('time', { class: 'muted small', datetime: item.date, text: formatDate(item.date) })),
    el('p', { class: 'news-summary', text: item.summary }),
    el('p', { class: 'muted small' },
      '출처: ',
      url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: item.source }) : item.source,
      linked.length ? ' · 관련 양조장: ' : '',
      linked.flatMap((b, i) => [
        i ? ', ' : '',
        el('a', { href: `brewery.html?id=${encodeURIComponent(b.id)}`, text: b.name }),
      ])));
}
