// 모든 화면이 함께 쓰는 바탕: 테마, 성인 확인, 아래쪽 메뉴, 끊겨도 보기(서비스 워커).
import { initTheme } from './theme.js';
import { myStore } from './store.js';
import { el } from './utils.js';

const TABS = [
  ['home', '발견', 'index.html'],
  ['rank', '순위', 'index.html#h-rank'],
  ['my', '내 술장', 'my.html'],
  ['region', '지역', 'index.html#h-region'],
];

function renderTabbar(active) {
  if (document.querySelector('.tabbar')) {
    return;
  }
  const nav = el('nav', { class: 'tabbar', 'aria-label': '주 메뉴' },
    TABS.map(([key, label, href]) => el('a', {
      href, 'data-tab': key, 'aria-current': key === active ? 'page' : null, text: label,
    })));
  document.body.append(nav);
  // 첫 화면 안에서는 어느 구역을 보고 있는지에 따라 표시를 옮긴다.
  if (active === 'home') {
    const mark = () => {
      const hash = window.location.hash;
      const now = hash === '#h-rank' ? 'rank' : hash === '#h-region' ? 'region' : 'home';
      nav.querySelectorAll('a').forEach((a) => {
        if (a.dataset.tab === now) {
          a.setAttribute('aria-current', 'page');
        } else {
          a.removeAttribute('aria-current');
        }
      });
    };
    window.addEventListener('hashchange', mark);
    mark();
  }
}

function ageGate() {
  const store = myStore();
  if (store.isAdult()) {
    return;
  }
  // 확인 화면 뒤의 내용은 누를 수도, 읽어 줄 수도 없게 막는다.
  const behind = [...document.body.children];
  behind.forEach((node) => { node.inert = true; });
  const body = el('div', { class: 'gate-box' });
  const gate = el('div', { class: 'gate', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gate-title' }, body);
  const close = () => {
    gate.remove();
    behind.forEach((node) => { node.inert = false; });
    document.documentElement.classList.remove('gated');
  };
  const ask = () => {
    const yes = el('button', { class: 'btn primary', type: 'button', text: '네, 만 19세 이상입니다' });
    const no = el('button', { class: 'btn', type: 'button', text: '아니요' });
    yes.addEventListener('click', () => {
      store.confirmAdult();
      close();
    });
    no.addEventListener('click', () => {
      const back = el('button', { class: 'btn', type: 'button', text: '다시 선택' });
      back.addEventListener('click', ask);
      body.replaceChildren(
        el('h2', { id: 'gate-title', text: '이용할 수 없습니다' }),
        el('p', { class: 'muted', text: '19세 미만은 이용할 수 없습니다. 창을 닫아 주세요.' }),
        el('div', { class: 'gate-actions' }, back));
      back.focus();
    });
    body.replaceChildren(
      el('p', { class: 'kicker', text: '전통주 발견' }),
      el('h2', { id: 'gate-title', text: '만 19세 이상이신가요?' }),
      el('p', { class: 'muted', text: '술에 관한 정보를 다루는 곳입니다. 19세 미만은 이용할 수 없습니다.' }),
      el('div', { class: 'gate-actions' }, yes, no));
    yes.focus();
  };
  document.documentElement.classList.add('gated');
  document.body.append(gate);
  ask();
}

function registerWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // 등록에 실패해도 화면은 그대로 쓴다(끊겼을 때만 못 볼 뿐이다).
    });
  });
}

/** active: 'home' | 'my' | null */
export function initApp(active = null) {
  // 뒤로 가기로 돌아온 옛 화면은 다른 화면에서 바꾼 찜·기록을 모르므로 새로 그린다.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });
  initTheme();
  renderTabbar(active);
  ageGate();
  registerWorker();
}
