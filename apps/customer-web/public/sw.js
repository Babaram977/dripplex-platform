/* DrippleX customer-web minimal service worker (Program C4 RC1).
 * Network-first for navigations; offline fallback page only.
 * Not a full offline commerce cache.
 *
 * DPX-CORE-001 Phase D-2 adds Firebase Cloud Messaging background push
 * handling to this same worker rather than registering a second
 * `firebase-messaging-sw.js` at the same scope — only one service worker
 * can control a given scope, and Firebase's compat build is designed to
 * be combined with a custom worker via importScripts() for exactly this
 * reason. This is a plain static file (no bundler touches it), so the
 * config below is the public Firebase web-app config, safe to embed —
 * not the Admin SDK service account the backend uses.
 */
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD0vd9bRE56mvy4Uwpt12_qJY82DpCgOtM',
  authDomain: 'dripplex-3a92d.firebaseapp.com',
  projectId: 'dripplex-3a92d',
  messagingSenderId: '520536680214',
  appId: '1:520536680214:web:6ca4773b35ee5df9b29237',
});

// Only background messages land here — a foreground tab handles push via
// onMessage() in the page itself (useForegroundPush, DPX-CORE-001 Phase D-3).
const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const title =
      payload.notification && payload.notification.title ? payload.notification.title : 'DrippleX';
    const body = payload.notification && payload.notification.body ? payload.notification.body : '';
    // `data` carries straight through to notificationclick below, since
    // that's a separate event with no access to this payload otherwise.
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      data: payload.data || {},
    });
  });
}

// DPX-CORE-001 Phase D-3 — tapping a background push opens (or focuses)
// the app at the notification's deep link. Marking it read happens once
// the app is actually open and authenticated (this worker has no access
// to the user's auth token), via the ?readNotification= param a focused
// page reads on load — see ReadNotificationOnOpen in customer-web.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetPath = data.deepLink || '/dashboard';
  const url = data.notificationId
    ? `${targetPath}?readNotification=${encodeURIComponent(data.notificationId)}`
    : targetPath;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => 'navigate' in client && 'focus' in client);
      if (existing) {
        return existing.navigate(url).then((client) => client && client.focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});

const OFFLINE_URL = '/offline.html';
const CACHE_NAME = 'dripplex-rc1-offline-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(OFFLINE_URL);
      return cached || Response.error();
    }),
  );
});
