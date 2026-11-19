const KEY = 'sool-theme';

function current() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function apply(theme, button) {
  document.documentElement.setAttribute('data-theme', theme);
  if (button) {
    button.textContent = theme === 'dark' ? '밝게' : '어둡게';
    button.setAttribute('aria-label', theme === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기');
  }
}

export function initTheme() {
  const button = document.getElementById('theme-toggle');
  apply(current(), button);
  if (!button) {
    return;
  }
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next, button);
    try {
      localStorage.setItem(KEY, next);
    } catch (err) {
      // 저장이 막힌 환경에서는 이번 화면에서만 적용한다.
    }
  });
}
