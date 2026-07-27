"use client";

import { useEffect } from "react";

/** Registreert de service worker. Faalt stil — de app werkt ook zonder. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
