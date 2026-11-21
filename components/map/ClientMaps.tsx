"use client";

import dynamic from "next/dynamic";

const placeholder = () => <div className="absolute inset-0 bg-map" aria-hidden="true" />;

/** Mapas cargados solo en el navegador (Leaflet necesita `window`). */
export const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false, loading: placeholder });
export const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false, loading: placeholder });
