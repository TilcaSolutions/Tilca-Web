"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CATEGORIES, categoryInfo, type Category } from "@/lib/constants";
import { formatPrice, formatWhen } from "@/lib/format";
import { OrganizerBanner } from "./OrganizerBanner";
import { distanceMeters } from "@/lib/geo";
import { overlaps, rangeFor, WHEN_LABELS, type WhenFilter } from "@/lib/time-filters";
import type { PublicEvent } from "@/lib/types";
import { Poster } from "./Poster";

const EventsMap = dynamic(() => import("./map/EventsMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-map">
      <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink-2 shadow-sm backdrop-blur-sm">
        <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
        Cargando mapa...
      </div>
    </div>
  ),
});

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function Explorer({ events }: { events: PublicEvent[] }) {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim();

  const [when, setWhen] = useState<WhenFilter | null>("semana");
  const [categories, setCategories] = useState<Set<Category>>(new Set());
  const [onlyFree, setOnlyFree] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const range = when ? rangeFor(when) : null;
    const q = normalize(query);
    const list = events.filter((e) => {
      if (range && !overlaps(e, range)) return false;
      if (categories.size && !categories.has(e.category)) return false;
      if (onlyFree && Number(e.price) !== 0) return false;
      if (q) {
        const haystack = normalize(
          [e.title, e.venue_name, e.venue_zone, e.organizers?.name, e.subcategory, categoryInfo(e.category).label]
            .filter(Boolean)
            .join(" "),
        );
        if (!q.split(/\s+/).every((word) => haystack.includes(word))) return false;
      }
      return true;
    });
    if (userLocation) {
      const d = (e: PublicEvent) => distanceMeters(userLocation[0], userLocation[1], e.lat, e.lng);
      list.sort((a, b) => d(a) - d(b));
    }
    return list;
  }, [events, when, categories, onlyFree, query, userLocation]);

  // El canal con el que se llega a la ficha: búsqueda si hay texto, mapa si no.
  const channel = query ? "busqueda" : "mapa";
  const hrefFor = useCallback((e: PublicEvent) => `/evento/${e.id}?c=${channel}`, [channel]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Tu navegador no permite ver tu ubicación.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocError(null);
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      () => setLocError("No pudimos ver tu ubicación. Revisa los permisos del navegador."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const countLabel = (() => {
    const n = filtered.length;
    const noun = n === 1 ? "evento" : "eventos";
    if (when) return `${n} ${noun} ${WHEN_LABELS[when].count}`;
    return `${n} ${n === 1 ? "próximo evento" : "próximos eventos"}`;
  })();

  function toggleCategory(id: Category) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setWhen(null);
    setCategories(new Set());
    setOnlyFree(false);
  }

  const hasActiveFilters = when !== null || categories.size > 0 || onlyFree || !!query;

  return (
    <>
      <OrganizerBanner />
      <div
        className="glass-header sticky top-16 z-30 flex h-14 flex-none items-center gap-2.5 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:px-6"
        aria-label="Filtros"
        role="toolbar"
      >
        <div role="group" aria-label="Cuándo" className="flex flex-none items-center rounded-control bg-fog p-[3px] shadow-xs">
          {(Object.keys(WHEN_LABELS) as WhenFilter[]).map((w) => {
            const on = when === w;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => setWhen(on ? null : w)}
                className={`h-[30px] whitespace-nowrap rounded-[6px] px-3 text-sm transition-all duration-200 active:scale-95 ${
                  on ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(23,25,30,0.14)]" : "text-ink-2 hover:text-ink"
                }`}
              >
                {WHEN_LABELS[w].button}
              </button>
            );
          })}
        </div>
        <span aria-hidden="true" className="h-6 w-px flex-none bg-line" />
        {CATEGORIES.map((c) => {
          const active = categories.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleCategory(c.id)}
              className={`group flex h-[34px] flex-none items-center gap-1.5 rounded-control border px-3 text-sm font-medium transition-all duration-200 active:scale-95 ${
                active
                  ? "border-ink bg-ink text-white font-semibold shadow-xs"
                  : "border-control bg-white text-ink hover:border-ink-3 hover:bg-fog"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full transition-transform duration-200 group-hover:scale-125"
                style={{ backgroundColor: c.color }}
                aria-hidden="true"
              />
              {c.label}
            </button>
          );
        })}
        <span aria-hidden="true" className="h-6 w-px flex-none bg-line" />
        <button
          type="button"
          aria-pressed={onlyFree}
          onClick={() => setOnlyFree((v) => !v)}
          className={`flex h-[34px] flex-none items-center gap-1.5 rounded-control border px-3 text-sm font-medium transition-all duration-200 active:scale-95 ${
            onlyFree
              ? "border-ink bg-ink text-white font-semibold shadow-xs"
              : "border-control bg-white text-ink hover:border-ink-3 hover:bg-fog"
          }`}
        >
          {onlyFree && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
          Solo gratis
        </button>
      </div>

      <main className="relative flex min-h-0 flex-1">
        <section
          aria-label="Eventos"
          className={`min-w-0 flex-1 flex-col overflow-y-auto border-line bg-surface md:flex md:max-w-[430px] md:flex-none md:basis-[430px] md:border-r ${
            view === "lista" ? "flex" : "hidden"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3 px-5 pt-[18px] pb-3">
            <h1 className="m-0 text-lg font-bold text-ink" aria-live="polite">
              {countLabel}
            </h1>
            {userLocation ? (
              <span className="flex items-center gap-1 text-sm font-medium text-ink-2">
                <span className="h-2 w-2 rounded-full bg-chart" />
                Más cercanos primero
              </span>
            ) : (
              <button
                type="button"
                onClick={locate}
                className="group flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform group-hover:scale-110">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
                <span className="link-underline">Ver cercanos</span>
              </button>
            )}
          </div>
          {locError && (
            <p className="mx-5 mb-3 rounded-md bg-warn-bg px-3 py-1.5 text-sm text-warn-ink border border-warn-line/70">
              {locError}
            </p>
          )}

          {filtered.length === 0 ? (
            <div className="animate-fade-in flex flex-col items-center justify-center border-t border-line px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-fog text-ink-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                  <path d="M8 11h6" />
                </svg>
              </div>
              <h2 className="mt-4 text-base font-semibold text-ink">No encontramos eventos con esos filtros</h2>
              <p className="mt-1 text-sm text-ink-2 max-w-[280px]">Prueba con otra fecha o desmarca alguna categoría.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn-secondary mt-4 h-9 px-4 text-sm"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            <ul className="m-0 list-none p-0 pb-24 md:pb-0">
              {filtered.map((e, i) => {
                const selected = e.id === selectedId;
                const cat = categoryInfo(e.category);
                return (
                  <li
                    key={e.id}
                    className="animate-slide-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                  >
                    <Link
                      href={hrefFor(e)}
                      onMouseEnter={() => setSelectedId(e.id)}
                      onFocus={() => setSelectedId(e.id)}
                      className={`group relative flex gap-3.5 border-t border-line px-5 py-3.5 transition-all duration-200 ${
                        i === filtered.length - 1 ? "border-b" : ""
                      } ${
                        selected
                          ? "bg-fog shadow-[inset_4px_0_0_var(--color-primary)]"
                          : "hover:bg-fog/60 hover:pl-6"
                      }`}
                    >
                      <div className="transition-transform duration-300 group-hover:scale-[1.03]">
                        <Poster title={e.title} category={e.category} posterUrl={e.poster_url} size="sm" />
                      </div>
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="text-[15px] sm:text-base font-semibold text-ink group-hover:text-primary transition-colors line-clamp-2">
                          {e.title}
                        </span>
                        <span className="text-sm text-ink-2 line-clamp-1">
                          {e.venue_name}
                          {e.venue_zone ? `, ${e.venue_zone}` : ""}
                        </span>
                        <span className="text-sm text-ink-2 font-medium">{formatWhen(e)}</span>
                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          {e.subcategory ? capitalize(e.subcategory) : cat.label}
                        </span>
                      </span>
                      <span className="self-start whitespace-nowrap rounded-md bg-fog px-2 py-1 text-sm font-semibold text-ink tabular border border-line/60">
                        {formatPrice(e.price)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-label="Mapa de eventos"
          className={`relative min-w-0 flex-1 overflow-hidden bg-map md:block ${view === "mapa" ? "block" : "hidden"}`}
        >
          <EventsMap
            events={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hrefFor={hrefFor}
            userLocation={userLocation}
            onLocate={locate}
          />
        </section>

        <button
          type="button"
          onClick={() => setView((v) => (v === "lista" ? "mapa" : "lista"))}
          className="glass-pill absolute bottom-6 left-1/2 z-[1100] flex h-12 -translate-x-1/2 items-center gap-2.5 rounded-full px-5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(23,25,30,0.35)] transition-all duration-200 active:scale-95 hover:bg-black md:hidden"
        >
          {view === "lista" ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
                <path d="M9 4v14M15 6v14" />
              </svg>
              <span>Ver el mapa</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              <span>Ver la lista</span>
            </>
          )}
        </button>
      </main>
    </>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
