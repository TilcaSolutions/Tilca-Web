"use client";

import L from "leaflet";
import "leaflet.markercluster";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { categoryInfo, LA_PAZ_CENTER } from "@/lib/constants";
import { formatPrice, formatWhen, lpParts } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";
import { Poster } from "../Poster";
import MapShell, { useStopMapEvents } from "./MapShell";

export interface EventsMapProps {
  events: PublicEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hrefFor: (e: PublicEvent) => string;
  userLocation: [number, number] | null;
  onLocate: () => void;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Mismo día en La Paz. */
function isToday(iso: string) {
  const a = lpParts(new Date(iso));
  const b = lpParts(new Date());
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function pinIcon(e: PublicEvent, selected: boolean) {
  const cat = categoryInfo(e.category);
  const classes = ["tilca-pin", selected && "is-selected", isToday(e.starts_at) && "is-today"].filter(Boolean).join(" ");
  return L.divIcon({
    className: "tilca-pin-wrap",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<button type="button" class="${classes}" style="--cat:${cat.color};--cat-ink:${cat.ink}" aria-label="${escapeHtml(
      `${e.title}, ${cat.label}, ${formatPrice(e.price)}`,
    )}" aria-pressed="${selected}"><span class="tilca-pin-cat" aria-hidden="true"></span>${escapeHtml(
      formatPrice(e.price),
    )}<span class="tilca-pin-title" aria-hidden="true">${escapeHtml(e.title)}</span></button>`,
  });
}

/** Anillo del grupo: un tramo por categoría, proporcional a cuántos eventos tiene. */
function clusterRing(categories: string[]) {
  const counts = new Map<string, number>();
  for (const c of categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  let at = 0;
  const stops: string[] = [];
  for (const [c, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    const end = at + (n / categories.length) * 360;
    stops.push(`${categoryInfo(c).color} ${at}deg ${end}deg`);
    at = end;
  }
  return `conic-gradient(${stops.join(", ")})`;
}

type CategorizedMarker = L.Marker & { options: L.MarkerOptions & { category?: string } };

/** Pines con precio, agrupados cuando están cerca. */
function PinsLayer({ events, selectedId, onSelect }: Pick<EventsMapProps, "events" | "selectedId" | "onSelect">) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      // Solo agrupa lo que de verdad se encima; de cerca (cuadra) muestra cada pin.
      maxClusterRadius: 30,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const n = cluster.getChildCount();
        const cats = (cluster.getAllChildMarkers() as CategorizedMarker[]).map((m) => m.options.category ?? "");
        return L.divIcon({
          className: "tilca-pin-wrap",
          iconSize: [46, 46],
          html: `<span class="tilca-cluster" style="--ring:${clusterRing(cats)}" role="img" aria-label="${n} eventos en esta zona"><span>${n}</span></span>`,
        });
      },
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    markersRef.current.clear();
    const markers = events.map((e) => {
      const m = L.marker([e.lat, e.lng], {
        icon: pinIcon(e, e.id === selectedId),
        zIndexOffset: e.id === selectedId ? 1000 : 0,
        keyboard: false,
        category: e.category,
      } as L.MarkerOptions);
      m.on("click", () => onSelectRef.current(e.id));
      markersRef.current.set(e.id, m);
      return m;
    });
    group.addLayers(markers);
  }, [events, selectedId]);

  useEffect(() => {
    for (const [id, m] of markersRef.current) {
      const e = events.find((x) => x.id === id);
      if (!e) continue;
      m.setIcon(pinIcon(e, id === selectedId));
      m.setZIndexOffset(id === selectedId ? 1000 : 0);
    }
  }, [selectedId, events]);

  useMapEvents({ click: () => onSelectRef.current(null) });
  return null;
}

/** Tarjeta del evento seleccionado, pegada al pin con animación pop-in. */
function SelectedCard({
  event,
  href,
  onClose,
}: {
  event: PublicEvent;
  href: string;
  onClose: () => void;
}) {
  const map = useMap();
  const [pos, setPos] = useState<{ x: number; y: number; w: number } | null>(null);
  const ref = useStopMapEvents<HTMLDivElement>();

  useEffect(() => {
    const update = () => {
      const p = map.latLngToContainerPoint([event.lat, event.lng]);
      setPos({ x: p.x, y: p.y, w: map.getSize().x });
    };
    update();
    map.on("move zoom resize", update);
    return () => {
      map.off("move zoom resize", update);
    };
  }, [map, event.lat, event.lng]);

  const flip = pos && pos.x + 360 > pos.w;
  const narrow = pos && pos.w < 640;

  const style: React.CSSProperties = narrow
    ? { left: 16, right: 16, bottom: 84 }
    : pos
      ? { left: flip ? pos.x - 340 : pos.x + 40, top: Math.max(16, pos.y - 40) }
      : { display: "none" };

  return (
    <div ref={ref} className="animate-pop-in absolute z-[1000]" style={style}>
      <div className="relative rounded-panel border border-line/80 bg-white/95 p-3.5 shadow-[0_8px_30px_rgba(23,25,30,0.18)] backdrop-blur-md sm:w-[320px]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar tarjeta"
          className="absolute -top-2.5 -right-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-ink-2 shadow-xs transition-colors hover:bg-fog hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <Link href={href} className="flex gap-3">
          <div className="flex-none">
            <Poster title={event.title} category={event.category} posterUrl={event.poster_url} size="card" />
          </div>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[15px] font-semibold text-ink line-clamp-1">{event.title}</span>
            <span className="text-[13px] font-medium text-ink-2">{formatWhen(event)}</span>
            <span className="text-[13px] text-ink-3 line-clamp-1">
              {event.venue_name}
            </span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-accent group-hover:underline">Ver detalles →</span>
              <span className="rounded bg-fog px-1.5 py-0.5 text-xs font-semibold text-ink tabular border border-line/60">
                {formatPrice(event.price)}
              </span>
            </div>
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Encuadra el mapa en los eventos que se están mostrando: al abrir y cada vez que cambian
 * los filtros. Si el mapa todavía no tiene tamaño (en el celular, antes de "Ver el mapa"),
 * espera al primer cambio de tamaño.
 */
function FitToEvents({ events }: { events: PublicEvent[] }) {
  const map = useMap();
  const eventsRef = useRef(events);
  const pending = useRef(true);
  const key = events.map((e) => e.id).sort().join(",");

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    const fit = () => {
      const list = eventsRef.current;
      const size = map.getSize();
      if (!list.length || size.x < 80 || size.y < 80) return;
      pending.current = false;
      const bounds = L.latLngBounds(list.map((e) => [e.lat, e.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 15, animate: true });
    };
    pending.current = true;
    fit();
    const onResize = () => {
      if (pending.current) fit();
    };
    map.on("resize", onResize);
    return () => {
      map.off("resize", onResize);
    };
  }, [map, key]);

  return null;
}

function UserLocation({ location }: { location: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!location) return;
    const marker = L.circleMarker(location, {
      radius: 8,
      color: "#FFFFFF",
      weight: 3,
      fillColor: "#1E7FC2",
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    map.flyTo(location, Math.max(map.getZoom(), 15), { duration: 0.6 });
    return () => {
      marker.remove();
    };
  }, [location, map]);
  return null;
}

export default function EventsMap({ events, selectedId, onSelect, hrefFor, userLocation, onLocate }: EventsMapProps) {
  const selected = events.find((e) => e.id === selectedId) ?? null;
  return (
    <MapShell center={LA_PAZ_CENTER} zoom={14} onLocate={onLocate} label="Mapa de eventos">
      <PinsLayer events={events} selectedId={selectedId} onSelect={onSelect} />
      <FitToEvents events={events} />
      <UserLocation location={userLocation} />
      {selected && (
        <SelectedCard
          key={selected.id}
          event={selected}
          href={hrefFor(selected)}
          onClose={() => onSelect(null)}
        />
      )}
    </MapShell>
  );
}
