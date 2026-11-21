/**
 * Lectura de eventos de Superticket (superticket.bo).
 *
 * Cada página de evento trae un bloque schema.org/Event (JSON-LD, el que la
 * ticketera publica para Google) con nombre, fecha, lugar, precio, imagen y link.
 * Si el evento tiene varias funciones, vienen en el selector de fechas
 * ("05 12 2026, 18:00hs"). Aquí solo se interpreta el HTML; las descargas
 * las hace scripts/import-superticket.ts.
 */
import type { Category } from "../constants";

export const SUPERTICKET = "superticket";
export const SUPERTICKET_HOME = "https://superticket.bo/";

export interface SourceShow {
  key: string; // estable entre corridas: id de la función o la fecha
  startsAt: string; // ISO con zona horaria de La Paz
}

export interface SourceEvent {
  url: string;
  title: string; // sin el sufijo de ciudad
  rawTitle: string;
  venueName: string | null;
  venueAddress: string | null;
  price: number | null; // null = Superticket muestra 0.00 (varios sectores o precio no publicado)
  imageUrl: string | null;
  shows: SourceShow[];
}

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

export function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Links a páginas de evento desde la portada (sin estáticos ni enlaces internos del sitio). */
export function parseEventLinks(homeHtml: string): string[] {
  const urls = new Set<string>();
  for (const [, href] of homeHtml.matchAll(/href="(https:\/\/superticket\.bo\/[^"#?]+)"/g)) {
    const path = new URL(href).pathname.replace(/\/+$/, "");
    if (!path || /^\/(media|static|auth|logout|cdn-cgi|atencion_cliente|cookie_policies)\b/.test(path)) continue;
    urls.add(`https://superticket.bo${path}/`);
  }
  return [...urls].sort();
}

interface JsonLdEvent {
  "@type"?: string;
  name?: string;
  startDate?: string;
  location?: { name?: string; address?: { streetAddress?: string } | string };
  image?: string | string[];
  offers?: { price?: string | number; url?: string } | { price?: string | number; url?: string }[];
}

function findJsonLdEvent(html: string): JsonLdEvent | null {
  for (const [, body] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(body);
      const items: JsonLdEvent[] = Array.isArray(data) ? data : [data];
      const ev = items.find((i) => i?.["@type"] === "Event");
      if (ev) return ev;
    } catch {
      // bloque mal formado: probamos el siguiente
    }
  }
  return null;
}

/** "05 12 2026, 18:00hs" -> ISO en hora de La Paz (UTC-4, sin horario de verano). */
export function parseShowDate(label: string): string | null {
  const m = label.match(/(\d{1,2})\s+(\d{1,2})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, d, mo, y, h, mi] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:00-04:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** La fecha del JSON-LD; si viene sin zona, se asume La Paz. */
function normalizeStart(start: string | undefined): string | null {
  if (!start) return null;
  const withTime = /T\d{2}:\d{2}/.test(start) ? start : `${start}T20:00:00`;
  const withZone = /([+-]\d{2}:?\d{2}|Z)$/.test(withTime) ? withTime : `${withTime}-04:00`;
  return Number.isNaN(Date.parse(withZone)) ? null : withZone;
}

const CITY_SUFFIX = /\s*[-–(]\s*(La Paz|El Alto|Oruro|Cochabamba|Santa Cruz|Sucre|Tarija|Potos[ií]|Cobija|Trinidad)\s*\)?\s*$/i;

export function cleanTitle(raw: string) {
  return raw.replace(CITY_SUFFIX, "").replace(/\s+/g, " ").trim() || raw;
}

export function parseEventPage(html: string, url: string): SourceEvent | null {
  const ld = findJsonLdEvent(html);
  if (!ld?.name) return null;

  const rawTitle = decodeEntities(ld.name);
  const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
  const priceNum = Number(offer?.price);
  const address = typeof ld.location?.address === "string" ? ld.location.address : ld.location?.address?.streetAddress;
  const image = Array.isArray(ld.image) ? ld.image[0] : ld.image;

  // Funciones del selector de fechas; si no hay, la fecha del JSON-LD.
  const shows: SourceShow[] = [];
  const seen = new Set<string>();
  for (const [, id, label] of html.matchAll(/data-valor="(\d+)"[^>]*>([^<]+)</g)) {
    const startsAt = parseShowDate(decodeEntities(label));
    if (startsAt && !seen.has(id)) {
      seen.add(id);
      shows.push({ key: `fecha-${id}`, startsAt });
    }
  }
  if (!shows.length) {
    const startsAt = normalizeStart(ld.startDate);
    if (startsAt) shows.push({ key: `inicio-${startsAt.slice(0, 16)}`, startsAt });
  }

  return {
    url,
    title: cleanTitle(rawTitle),
    rawTitle,
    venueName: ld.location?.name ? decodeEntities(ld.location.name) : null,
    venueAddress: address ? decodeEntities(address) : null,
    price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
    imageUrl: image ? new URL(image, SUPERTICKET_HOME).href : null,
    shows,
  };
}

// --- Ciudad -----------------------------------------------------------------
// Las expresiones se aplican sobre el texto normalizado (minúsculas, sin tildes):
// así "Sinfonía", "Ópera" o "Folklórica" coinciden sin pelear con tildes y \b.

const LA_PAZ = /\b(la paz|el alto)\b/;
const OTHER_CITY =
  /\b(oruro|cochabamba|santa cruz|sucre|tarija|potosi|cobija|trinidad|montero|quillacollo|uajms|raul otero reiche)\b/;

/**
 * 'lapaz' si el título o el lugar lo dicen, 'otra' si nombran otra ciudad, 'desconocida' si no.
 * El título manda ("Farmeando Risas - La Paz"). La dirección no se mira: en La Paz hay calles
 * Potosí, Sucre, Oruro y la Av. Mariscal Santa Cruz, y confundirían la ciudad.
 */
export function detectCity(ev: Pick<SourceEvent, "rawTitle" | "venueName">): "lapaz" | "otra" | "desconocida" {
  const title = normalizeName(ev.rawTitle);
  const venue = normalizeName(ev.venueName ?? "");
  if (LA_PAZ.test(title)) return "lapaz";
  if (OTHER_CITY.test(title) || OTHER_CITY.test(venue)) return "otra";
  if (LA_PAZ.test(venue)) return "lapaz";
  return "desconocida";
}

// --- Categoría ----------------------------------------------------------------

/** Lo que no es agenda cultural (concursos, deporte, fiestas privadas, ferias). */
const NOT_CULTURAL =
  /\b(miss|zumba|carrera|maraton|fiesta de gala|graduacion|promocion|generacion \d{4}|coffe+e? village|feria|expo ?venta|masterclass)\b/;

// Prefijos (sin \b final) para cubrir variantes: sinfonía/sinfónico, folklórica/folklore.
const RULES: [Category, RegExp][] = [
  ["standup", /\b(stand ?up|comedia|risas|humor|monologo|impro)/],
  ["danza", /\b(danza|ballet|folklor|tusuy|tango|salsa|baile)/],
  ["arte", /\b(exposicion|muestra|galeria|fotografia|pintura)/],
  ["teatro", /\b(teatro|obra|musical|opera|cuentos|titeres|drag)/],
  ["musica", /\b(concierto|sinfoni|orquesta|tributo|rock|jazz|coro|oratorio|vinilo|dj|electro|festival|en vivo|recital|piano|cumbia|banda)/],
];

/**
 * Categoría por palabras clave en el título (y el lugar, solo para "teatro").
 * `null` si no es agenda cultural; `guess: true` si no hubo ninguna pista clara.
 */
export function classify(title: string, venueName: string | null): { category: Category; guess: boolean } | null {
  const t = normalizeName(title);
  if (NOT_CULTURAL.test(t)) return null;
  for (const [category, re] of RULES) if (re.test(t)) return { category, guess: false };
  // "Kakuy se llama y vive penando" en un teatro: casi seguro es teatro, pero mejor revisarlo.
  if (venueName && /\bteatro\b/.test(normalizeName(venueName))) return { category: "teatro", guess: true };
  return { category: "musica", guess: true };
}

/** Para comparar nombres de lugares y títulos sin tildes, mayúsculas ni espacios de más. */
export function normalizeName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
