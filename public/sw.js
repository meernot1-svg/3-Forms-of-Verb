// VerbMaster service worker — offline-first caching.
// Caches app shell, verbs.json, and fonts for full offline use after first load.
const CACHE = "verbmaster-v1";
const SHELL = [
  "/",
  "/verbs.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigations (so updates come through), fallback to cache.
// Cache-first for static assets and verbs.json (offline-friendly, low data).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Don't intercept Next.js dev/HMR requests
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }
  // static + json: cache-first
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached)
    )
  );
});

// in-app reminder/notifications (PWA) — show a notification when scheduled
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SCHEDULE_REMINDER") {
    const { title, body, delayMs } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "verbmaster-reminder",
      });
    }, Math.max(0, delayMs || 0));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((clients) => {
    if (clients[0]) return clients[0].focus();
    return self.clients.openWindow("/");
  }));
});
