import { lpParts } from "./format";
import type { TilcaEvent } from "./types";

export type WhenFilter = "hoy" | "finde" | "semana";

const LA_PAZ_OFFSET_HOURS = -4; // Bolivia no tiene horario de verano

/** Medianoche de La Paz del día que contiene `d`, desplazada `addDays` días. */
export function lpMidnight(d: Date, addDays = 0) {
  const p = lpParts(d);
  return new Date(Date.UTC(p.year, p.month, p.day + addDays, -LA_PAZ_OFFSET_HOURS, 0, 0));
}

export function rangeFor(when: WhenFilter, now = new Date()): [Date, Date] {
  const weekday = lpParts(now).weekday; // 0 = domingo
  if (when === "hoy") return [lpMidnight(now, 0), lpMidnight(now, 1)];
  if (when === "semana") return [lpMidnight(now, 0), lpMidnight(now, 7)];
  // Este finde: de viernes a domingo.
  const daysToFriday = weekday === 0 ? -2 : 5 - weekday;
  const daysToMonday = weekday === 0 ? 1 : 8 - weekday;
  const start = lpMidnight(now, daysToFriday);
  return [start, lpMidnight(now, daysToMonday)];
}

/** El evento ocurre (o sigue abierto) en algún momento del rango. */
export function overlaps(e: Pick<TilcaEvent, "starts_at" | "ends_at" | "duration_min">, [from, to]: [Date, Date]) {
  if (!e.starts_at) return false;
  const start = new Date(e.starts_at);
  const end = e.ends_at
    ? new Date(e.ends_at)
    : new Date(start.getTime() + (e.duration_min ?? 120) * 60_000);
  return start < to && end > from;
}

export const WHEN_LABELS: Record<WhenFilter, { button: string; count: string }> = {
  hoy: { button: "Hoy", count: "hoy" },
  finde: { button: "Este finde", count: "este finde" },
  semana: { button: "Esta semana", count: "esta semana" },
};
