const CACHE_NAME = 'journey-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// 서비스 워커 설치 및 핵심 리소스 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// 서비스 워커 활성화 및 구버전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 네트워크 요청 가로채기 (캐시 우선, 없으면 네트워크 탐색)
self.addEventListener('fetch', event => {
  // HTTP/HTTPS가 아닌 요청(ws, chrome-extension 등) 처리 제외
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // 외부 파이어베이스 데이터베이스 요정 통신(firestore)은 캐싱에서 제외하여 동기화 유지
  if (event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).catch(error => {
          console.error('Fetch failed:', event.request.url, error);
        });
      })
  );
});