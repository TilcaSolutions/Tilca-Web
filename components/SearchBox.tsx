"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Buscador del encabezado. En el inicio (`live`) filtra mientras escribes;
 * en otras páginas lleva al mapa con la búsqueda.
 */
export function SearchBox({ live }: { live: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);

  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== value.trim()) setValue(urlQuery);
  }

  function push(next: string, mode: "replace" | "push") {
    const sp = new URLSearchParams(live ? params.toString() : "");
    if (next.trim()) sp.set("q", next.trim());
    else sp.delete("q");
    const qs = sp.toString();
    const href = `${live ? pathname : "/"}${qs ? `?${qs}` : ""}`;
    if (mode === "replace") router.replace(href, { scroll: false });
    else router.push(href);
  }

  function handleClear() {
    setValue("");
    if (live) push("", "replace");
  }

  return (
    <form
      role="search"
      className="min-w-0 flex-1 sm:max-w-[440px]"
      onSubmit={(e) => {
        e.preventDefault();
        push(value, live ? "replace" : "push");
      }}
    >
      <div className="group relative flex h-10 items-center gap-2.5 rounded-control border border-transparent bg-fog px-3.5 text-ink-3 transition-all duration-200 focus-within:border-accent/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/15 focus-within:shadow-xs">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="flex-none text-ink-3 transition-colors group-focus-within:text-accent"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Busca una obra, artista o lugar"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (live) push(e.target.value, "replace");
          }}
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3/70"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Borrar búsqueda"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-line text-ink-2 hover:bg-control hover:text-ink transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
