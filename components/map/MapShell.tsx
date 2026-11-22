"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, type ReactNode } from "react";
import L from "leaflet";

/**
 * Tiles claros y sobrios. Por defecto Stadia "Alidade Smooth" (parecido a CARTO Positron):
 * funciona sin clave en localhost; en producción hay que registrar el dominio en Stadia (gratis).
 * Para usar otro proveedor (p. ej. CARTO Positron con clave), define NEXT_PUBLIC_MAP_TILE_URL
 * y NEXT_PUBLIC_MAP_TILE_ATTRIBUTION. Ver README.
 */
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const controlBtn =
  "flex h-10 w-10 items-center justify-center bg-white text-xl text-ink hover:bg-fog focus-visible:outline-2";

/** Evita que los clics y arrastres sobre controles propios muevan el mapa. */
export function useStopMapEvents<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  return ref;
}

/** Recalcula el tamaño cuando el contenedor cambia (p. ej. al pasar de lista a mapa en el celular). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function Controls({ onLocate }: { onLocate?: () => void }) {
  const map = useMap();
  const ref = useStopMapEvents<HTMLDivElement>();
  return (
    <div ref={ref} className="absolute right-4 bottom-6 z-[1000] flex flex-col gap-2 sm:right-5">
      <div className="flex flex-col overflow-hidden rounded-control bg-white shadow-[0_1px_3px_rgba(23,25,30,0.2)]">
        <button type="button" aria-label="Acercar" className={`${controlBtn} border-b border-line`} onClick={() => map.zoomIn()}>
          +
        </button>
        <button type="button" aria-label="Alejar" className={controlBtn} onClick={() => map.zoomOut()}>
          −
        </button>
      </div>
      {onLocate && (
        <button
          type="button"
          aria-label="Ir a mi ubicación"
          onClick={onLocate}
          className={`${controlBtn} rounded-control shadow-[0_1px_3px_rgba(23,25,30,0.2)]`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface MapShellProps {
  center: LatLngExpression;
  zoom: number;
  children?: ReactNode;
  onLocate?: () => void;
  label: string;
  onReady?: (map: LeafletMap) => void;
}

export default function MapShell({ center, zoom, children, onLocate, label, onReady }: MapShellProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      scrollWheelZoom
      className="absolute inset-0"
      attributionControl
      ref={(m) => {
        if (m && onReady) onReady(m);
      }}
      aria-label={label}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" maxZoom={19} />
      <AutoResize />
      {children}
      <Controls onLocate={onLocate} />
    </MapContainer>
  );
}
