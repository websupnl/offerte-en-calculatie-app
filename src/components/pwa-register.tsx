"use client";

import { useEffect } from "react";

/** Registreert de service worker. Faalt stil — de app werkt ook zonder. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // In dev krijgen chunks bij elke wijziging een andere naam. Een cache-first service
    // worker blijft dan verouderde chunks serveren en geeft "module factory is not available".
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
      return;
    }

    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
