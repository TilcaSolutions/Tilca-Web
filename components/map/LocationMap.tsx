"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import MapShell from "./MapShell";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function Overlay({ lat, lng, title, venue }: { lat: number; lng: number; title: string; venue: string }) {
  const map = useMap();
  useEffect(() => {
    const layers: L.Layer[] = [];
    const pin = L.marker([lat, lng], {
      keyboard: false,
      interactive: false,
      icon: L.divIcon({
        className: "tilca-pin-wrap",
        iconSize: [0, 0],
        html: `<span class="tilca-pin is-selected" role="img" aria-label="${escapeHtml(`${title}, ${venue}`)}">${escapeHtml(title)}</span>`,
      }),
      zIndexOffset: 1000,
    });
    layers.push(pin);

    layers.forEach((l) => l.addTo(map));
    return () => layers.forEach((l) => l.remove());
  }, [map, lat, lng, title, venue]);
  return null;
}

export default function LocationMap(props: { lat: number; lng: number; title: string; venue: string }) {
  return (
    <MapShell center={[props.lat, props.lng]} zoom={16} label="Ubicación del evento">
      <Overlay {...props} />
    </MapShell>
  );
}
