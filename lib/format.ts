import { TIME_ZONE } from "./constants";
import type { TilcaEvent } from "./types";

const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Partes de una fecha en la hora de La Paz. */
export function lpParts(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
    day: Number(get("day")),
    hour: get("hour"),
    minute: get("minute"),
    weekday: weekdayMap[get("weekday")],
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Vie 27 nov, 20:00" */
export function formatShort(iso: string) {
  const p = lpParts(iso);
  return `${WEEKDAYS_SHORT[p.weekday]} ${p.day} ${MONTHS_SHORT[p.month]}, ${p.hour}:${p.minute}`;
}

/** "Viernes 27 de noviembre, 20:00" */
export function formatLong(iso: string) {
  const p = lpParts(iso);
  return `${cap(WEEKDAYS[p.weekday])} ${p.day} de ${MONTHS[p.month]}, ${p.hour}:${p.minute}`;
}

/** "27 nov" */
export function formatDayMonth(iso: string) {
  const p = lpParts(iso);
  return `${p.day} ${MONTHS_SHORT[p.month]}`;
}

/** "martes 24" */
export function formatWeekdayDay(iso: string) {
  const p = lpParts(iso);
  return `${WEEKDAYS[p.weekday]} ${p.day}`;
}

export function weekdayLong(iso: string) {
  return WEEKDAYS[lpParts(iso).weekday];
}

/** Fecha que se muestra en listas: exposiciones en curso muestran "Hasta el 13 dic". */
export function formatWhen(e: Pick<TilcaEvent, "starts_at" | "ends_at">, now = new Date()) {
  if (!e.starts_at) return "Sin fecha";
  if (e.ends_at && new Date(e.starts_at) <= now) {
    return `Hasta el ${formatDayMonth(e.ends_at)}`;
  }
  return formatShort(e.starts_at);
}

export function formatPrice(price: number | null | undefined) {
  if (price === null || price === undefined) return "–";
  if (Number(price) === 0) return "Gratis";
  return `Bs ${Number(price).toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
}

export function isPresaleActive(e: Pick<TilcaEvent, "presale_price" | "presale_until">, now = new Date()) {
  return e.presale_price !== null && !!e.presale_until && new Date(e.presale_until) > now;
}

/** Precio que paga hoy quien compra (preventa si está activa). */
export function currentPrice(e: Pick<TilcaEvent, "price" | "presale_price" | "presale_until">, now = new Date()) {
  return isPresaleActive(e, now) ? Number(e.presale_price) : e.price === null ? null : Number(e.price);
}

/** Monto en bolivianos: 48 -> "Bs 48", 48.5 -> "Bs 48,50". */
export function formatBs(n: number | null | undefined) {
  const v = Number(n ?? 0);
  const cents = Math.round(v * 100) % 100 !== 0;
  return `Bs ${v.toLocaleString("es-BO", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "ahorras Bs 5" / "ahorras 10%" según el descuento del código. */
export function discountLabel(e: Pick<TilcaEvent, "discount_amount" | "discount_unit">) {
  if (!e.discount_amount || !e.discount_unit) return null;
  return e.discount_unit === "pct" ? `${Number(e.discount_amount)}%` : formatBs(e.discount_amount);
}

/** 1240 -> "1 240" */
export function formatCount(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return n.toLocaleString("es-BO").replace(/[.,]/g, " ");
}

export function percent(part: number | null | undefined, total: number | null | undefined) {
  if (!total || !part || Number.isNaN(total) || Number.isNaN(part)) return 0;
  return Math.round((part / total) * 100);
}

/** "superticket.bo" -> "Superticket" */
export function ticketSiteName(url: string | null) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0];
    return cap(base);
  } catch {
    return null;
  }
}

export function plural(n: number, one: string, many: string) {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/** Fecha de hace `h` horas (para dejar visibles las funciones que recién empezaron). */
export function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600 * 1000);
}
