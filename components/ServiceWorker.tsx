"use client";

import { useEffect } from "react";

/** Registra el service worker para que TILCA se pueda instalar en el celular. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin service worker la web funciona igual.
    });
  }, []);
  return null;
}
