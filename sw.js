/* ObraLab · service worker: funciona sin señal en obra y trae lo nuevo cuando hay conexión */
const VERSION = "obralab-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "modulos/acero.js", "modulos/escalera.js", "modulos/materiales.js",
  "data/herramientas.json", "data/actualizaciones.json", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const local = url.origin === self.location.origin;
  // datos, página y módulos: primero la red (para ver las novedades diarias), si no hay señal, lo guardado
  if (local && (req.mode === "navigate" || /\/data\/|\.js$|\.html$|\/$/.test(url.pathname))) {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(url.pathname.endsWith("/") ? "./" : url.pathname, copy)); }
      return r;
    }).catch(() => caches.match(url.pathname.endsWith("/") || req.mode === "navigate" ? "./" : url.pathname, { ignoreSearch: true })
      .then((m) => m || caches.match(req, { ignoreSearch: true }))));
    return;
  }
  // íconos, manifiesto y tipografías: lo guardado primero
  if (local || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then((r) => {
      if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return r;
    })));
  }
});
