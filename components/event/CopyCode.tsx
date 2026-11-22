"use client";

import { useState } from "react";

/**
 * El código TILCA con su botón "Copiar código". Si `track` trae un evento, copiar
 * cuenta como clic de compra (para eventos que venden solo por QR o en puerta, donde
 * no hay botón "Comprar").
 */
export function CopyCode({ code, track }: { code: string; track?: { eventId: string; channel: string | null } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-panel border-2 border-dashed border-ink/70 bg-surface px-4 py-3.5 transition-all hover:border-ink">
      <span
        className="font-condensed text-[30px] leading-none font-extrabold tracking-wider whitespace-nowrap text-ink tabular select-all sm:text-[34px]"
        aria-label={`Código ${code.split("").join(" ")}`}
      >
        {code}
      </span>
      <button
        type="button"
        className={`h-10 flex-none rounded-control px-4 text-sm font-semibold transition-all duration-200 active:scale-95 ${
          copied ? "bg-primary text-white shadow-xs" : "btn-secondary"
        }`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
          if (track) {
            void fetch("/api/clic", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(track),
              keepalive: true,
            }).catch(() => {});
          }
        }}
      >
        {copied ? (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Copiado
          </span>
        ) : (
          "Copiar código"
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Código copiado" : ""}
      </span>
    </div>
  );
}
