"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Franja para organizadores arriba de los filtros del inicio. Se puede cerrar y el cierre
 * se recuerda en localStorage (si no hay localStorage, se cierra solo por esta visita).
 */
const KEY = "tilca-banner-organizadores-cerrado";
const listeners = new Set<() => void>();
let closedThisVisit = false;

function isClosed() {
  if (closedThisVisit) return true;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function OrganizerBanner() {
  // En el servidor se asume cerrada: así no aparece y desaparece al hidratar.
  const closed = useSyncExternalStore(subscribe, isClosed, () => true);
  if (closed) return null;

  return (
    <div className="flex flex-none items-center gap-3 border-b border-primary/15 bg-primary-soft px-4 py-2 text-sm text-primary sm:px-6">
      <p className="m-0 min-w-0 flex-1">
        <span className="font-semibold">¿Organizas eventos?</span> Publica gratis y paga 5% solo por las entradas que vendemos.{" "}
        <Link href="/organizadores" className="font-semibold whitespace-nowrap underline underline-offset-2">
          Cómo funciona
        </Link>
      </p>
      <button
        type="button"
        aria-label="Cerrar aviso para organizadores"
        onClick={() => {
          closedThisVisit = true;
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // sin localStorage: queda cerrada solo en esta visita
          }
          listeners.forEach((l) => l());
        }}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-primary hover:bg-primary/10"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
