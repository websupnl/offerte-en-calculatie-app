/**
 * Service worker voor de Werkplek-PWA.
 *
 * Twee dingen: de app-schil offline beschikbaar houden, en pushmeldingen
 * ontvangen. Data wordt bewust NIET gecachet — een verouderde takenlijst is
 * erger dan een foutmelding dat je offline bent.
 */

var CACHE = "werkplek-v1";
var SHELL = ["/offline", "/icons/icon-192.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () {
        // Ontbrekend icoon mag de installatie niet blokkeren.
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; })
            .map(function (key) { return caches.delete(key); }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API en auth nooit uit cache — die moeten vers zijn of eerlijk falen.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match("/offline").then(function (cached) {
          return cached || new Response("Je bent offline.", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        });
      }),
    );
    return;
  }

  // Statische assets: uit cache als het kan, anders ophalen en bewaren.
  if (/\.(css|js|woff2?|png|jpg|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        return (
          cached ||
          fetch(request).then(function (response) {
            var copy = response.clone();
            caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
            return response;
          })
        );
      }),
    );
  }
});

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Werkplek", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Werkplek", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "werkplek",
      data: { url: data.url || "/dashboard" },
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      // Al een venster open? Dan daarheen navigeren i.p.v. een tweede openen.
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.location.origin) === 0 && "focus" in list[i]) {
          list[i].navigate(target);
          return list[i].focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
