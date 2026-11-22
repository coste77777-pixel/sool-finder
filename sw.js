// 끊겨도 보기: 인터넷이 될 때는 늘 새 것을 받아 오고, 안 될 때만 마지막으로 받은 것을 보여 준다.
const PREFIX = 'sool-';
// 공개용 폴더를 만들 때(tools/publish.py) 파일 내용에 맞춰 이 이름이 바뀐다. 이름이 바뀌면 화면 파일을 새로 담는다.
const CACHE = 'sool-268733ad40';
const NETWORK_WAIT_MS = 3000;
const SHELL = [
  './', 'index.html', 'drink.html', 'brewery.html', 'about.html', 'my.html', 'privacy.html',
  'css/style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'js/app.js', 'js/store.js', 'js/theme.js', 'js/utils.js', 'js/data.js',
  'js/main-index.js', 'js/main-drink.js', 'js/main-brewery.js', 'js/main-about.js', 'js/main-my.js',
  'data/breweries.json', 'data/drinks.json', 'data/rankings.json', 'data/meta.json', 'data/news.json',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  // 하나가 실패해도 나머지는 담는다.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // 같은 주소(github.io)를 쓰는 다른 사이트의 저장분은 건드리지 않는다.
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()));
});

// 화면 주소의 ?id=… 는 빼고 담는다(화면 파일은 하나이고, 내용은 자료 파일에서 온다).
function cacheKey(request) {
  const url = new URL(request.url);
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    url.search = '';
    url.hash = '';
    return url.href;
  }
  return request;
}

function timeout(ms) {
  return new Promise((resolve, reject) => { setTimeout(() => reject(new Error('timeout')), ms); });
}

// 새 것을 먼저 받되, 신호가 약해 3초 넘게 걸리거나 서버가 오류를 내면 마지막으로 받은 것을 보여 준다.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const key = cacheKey(request);
  const cached = await cache.match(key);
  const fresh = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(key, response.clone());
    }
    return response;
  });
  try {
    const response = await (cached ? Promise.race([fresh, timeout(NETWORK_WAIT_MS)]) : fresh);
    if (!response.ok && cached) {
      return cached;
    }
    return response;
  } catch (err) {
    fresh.catch(() => {});
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      const home = await cache.match(new URL('index.html', self.registration.scope).href);
      if (home) {
        return home;
      }
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  // 글꼴 주소는 다른 사이트라 속을 볼 수 없는 응답(opaque)으로 올 수 있다. 그것도 담아 둔다.
  if (response.ok || response.type === 'opaque') {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
  // 그 밖의 주소(제품 사진 등)는 건드리지 않는다. 끊겼을 때는 병 그림이 대신 나온다.
});
