"use client";

import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-panel border-2 border-dashed border-ink/70 bg-fog px-4 py-4 transition-all hover:border-ink">
      <span
        className="font-condensed text-[30px] leading-none font-extrabold whitespace-nowrap tracking-wider tabular sm:text-[36px] text-ink select-all"
        aria-label={`Código ${code.split("").join(" ")}`}
      >
        {code}
      </span>
      <button
        type="button"
        className={`h-10 flex-none rounded-control px-4 text-sm font-semibold transition-all duration-200 active:scale-95 ${
          copied
            ? "bg-ok text-white shadow-xs"
            : "btn-secondary"
        }`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Copiado
          </span>
        ) : (
          "Copiar"
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Código copiado" : ""}
      </span>
    </div>
  );
}
