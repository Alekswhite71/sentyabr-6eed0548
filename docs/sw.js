/* Service worker: офлайн-кэш + приём ежедневных пуш-уведомлений. */

const CACHE = "nash-sentyabr-v12";

// HTML и phrases.json НЕ кладём в предкэш — иначе на iPhone
// после обновления сайта долго крутится старая открытка.
const CORE = [
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./photos/cover.jpg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isOwn = url.origin === self.location.origin;
  if (!isOwn) return;

  const path = url.pathname;
  const isHtml = req.mode === "navigate" || path.endsWith("/") || path.endsWith(".html");
  const isPhrases = path.endsWith("phrases.json");
  const isSw = path.endsWith("sw.js");

  // страница, фразы и сам worker — только из сети (кэш лишь если офлайн)
  if (isHtml || isPhrases || isSw) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => res)
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // фото и иконки — сеть вперёд, потом кэш
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

/* Ежедневный пуш от GitHub Actions */
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (_) {
    d = { title: "♥", body: e.data ? e.data.text() : "" };
  }

  const title = d.title || "♥ Сообщение для тебя";
  const opts = {
    body: d.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: d.tag || "daily",
    renotify: true,
    data: { url: d.url || "./" }
  };

  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
