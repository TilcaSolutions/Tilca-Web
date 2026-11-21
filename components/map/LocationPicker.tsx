"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { LA_PAZ_CENTER } from "@/lib/constants";
import MapShell from "./MapShell";

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
}

const pinIcon = L.divIcon({
  className: "tilca-pin-wrap",
  iconSize: [0, 0],
  html: `<span class="tilca-pin is-selected" style="cursor:grab">Aquí</span>`,
});

function Picker({ value, onChange }: Props) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useMapEvents({
    click(e) {
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  useEffect(() => {
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const m = L.marker([value.lat, value.lng], { draggable: true, icon: pinIcon, keyboard: false }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }
    if (!map.getBounds().contains([value.lat, value.lng])) map.panTo([value.lat, value.lng]);
  }, [value, map]);

  useEffect(() => () => void markerRef.current?.remove(), []);
  return null;
}

export default function LocationPicker({ value, onChange }: Props) {
  return (
    <MapShell center={value ? [value.lat, value.lng] : LA_PAZ_CENTER} zoom={value ? 16 : 14} label="Elige el lugar en el mapa">
      <Picker value={value} onChange={onChange} />
    </MapShell>
  );
}
