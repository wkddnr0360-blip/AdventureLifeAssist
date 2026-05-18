const CACHE_NAME = 'adv-life-assist-v1';

// 사진의 구조에 맞춘 캐싱할 파일 목록 (GitHub Pages 경로 적용)
const urlsToCache = [
  '/AdventureLifeAssist/',
  '/AdventureLifeAssist/index.html',
  '/AdventureLifeAssist/styles/main.css',
  '/AdventureLifeAssist/js/appState.js',
  '/AdventureLifeAssist/js/authCtrl.js',
  '/AdventureLifeAssist/js/dataCtrl.js',
  '/AdventureLifeAssist/js/firebaseConfig.js',
  '/AdventureLifeAssist/js/main.js',
  '/AdventureLifeAssist/js/mapCtrl.js',
  '/AdventureLifeAssist/js/tavernCtrl.js',
  '/AdventureLifeAssist/js/uiCtrl.js',
  '/AdventureLifeAssist/js/utils.js',
  '/AdventureLifeAssist/icon-192.png',
  '/AdventureLifeAssist/icon-512.png',
  '/AdventureLifeAssist/manifest.json'
];

// 서비스 워커 설치 및 파일 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 네트워크 요청 가로채기 (캐시에 있으면 캐시 반환, 없으면 네트워크 요청)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// 새로운 버전 업데이트 시 이전 캐시 삭제
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
