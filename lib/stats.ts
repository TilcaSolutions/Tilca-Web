import type { SupabaseClient } from "@supabase/supabase-js";
import { CHANNELS, type Channel } from "./constants";
import { lpParts } from "./format";
import { lpMidnight } from "./time-filters";

export interface SaleRow {
  id: number | string;
  source: "ticketera" | "puerta";
  quantity: number;
  evidence_path: string | null;
  is_sample: boolean;
  created_at: string;
}

export interface EventStats {
  views: number;
  clicks: number;
  /** Entradas confirmadas con el código TILCA en el periodo. */
  tickets: number;
  /** De dónde vinieron los clics en "Comprar" (las ventas confirmadas no traen canal). */
  channels: { id: Channel | "directo"; label: string; count: number }[];
  days: { date: Date; count: number; topChannel: Channel | null }[];
}

export type Period = "7" | "todo";

/** Carga vistas, clics y ventas confirmadas de un evento (el RLS solo deja ver los del dueño). */
export async function loadEventStats(
  supabase: SupabaseClient,
  eventId: string,
  period: Period,
  publishedAt: string | null,
  now = new Date(),
): Promise<EventStats> {
  const since =
    period === "7"
      ? lpMidnight(now, -6)
      : publishedAt
        ? lpMidnight(new Date(publishedAt))
        : lpMidnight(now, -29);
  const sinceIso = since.toISOString();

  const [viewsRes, clicksRes, salesRes] = await Promise.all([
    supabase.from("views").select("id", { count: "exact", head: true }).eq("event_id", eventId).gte("created_at", sinceIso),
    supabase.from("clicks").select("channel").eq("event_id", eventId).gte("created_at", sinceIso).limit(20000),
    supabase.from("sales_confirmations").select("quantity, created_at").eq("event_id", eventId).gte("created_at", sinceIso),
  ]);

  const clickRows = (clicksRes.data ?? []) as { channel: Channel | null }[];
  const byChannel = new Map<string, number>();
  for (const c of clickRows) byChannel.set(c.channel ?? "directo", (byChannel.get(c.channel ?? "directo") ?? 0) + 1);
  const channels: EventStats["channels"] = CHANNELS.map((ch) => ({ id: ch.id, label: ch.label, count: byChannel.get(ch.id) ?? 0 }));
  if (byChannel.get("directo")) channels.push({ id: "directo", label: "Link directo", count: byChannel.get("directo")! });

  // Ventas confirmadas por día (hora de La Paz), desde `since` hasta hoy.
  const sales = (salesRes.data ?? []) as { quantity: number; created_at: string }[];
  const totalDays = Math.min(60, Math.max(1, Math.round((lpMidnight(now, 1).getTime() - since.getTime()) / 86_400_000)));
  const firstDay = lpMidnight(now, -(totalDays - 1));
  const days: EventStats["days"] = Array.from({ length: totalDays }, (_, i) => ({
    date: new Date(firstDay.getTime() + i * 86_400_000),
    count: 0,
    topChannel: null,
  }));
  for (const s of sales) {
    const idx = Math.floor((lpMidnight(new Date(s.created_at)).getTime() - firstDay.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days.length) days[idx].count += Number(s.quantity);
  }

  return {
    views: viewsRes.count ?? 0,
    clicks: clickRows.length,
    tickets: sales.reduce((n, s) => n + Number(s.quantity), 0),
    channels,
    days,
  };
}

export interface EventTotals {
  views: number;
  clicks: number;
  /** Entradas confirmadas con el código TILCA. */
  tickets: number;
}

/** Totales por evento (y opcionalmente desde una fecha) para la tabla y el resumen. */
export async function loadTotals(
  supabase: SupabaseClient,
  eventIds: string[],
  since?: Date,
): Promise<Map<string, EventTotals>> {
  const result = new Map<string, EventTotals>();
  if (!eventIds.length) return result;
  for (const id of eventIds) result.set(id, { views: 0, clicks: 0, tickets: 0 });

  const sinceIso = since?.toISOString();
  let sales = supabase.from("sales_confirmations").select("event_id, quantity").in("event_id", eventIds);
  if (sinceIso) sales = sales.gte("created_at", sinceIso);
  const [salesRes] = await Promise.all([
    sales,
    ...eventIds.map(async (id) => {
      let views = supabase.from("views").select("id", { count: "exact", head: true }).eq("event_id", id);
      let clicks = supabase.from("clicks").select("id", { count: "exact", head: true }).eq("event_id", id);
      if (sinceIso) {
        views = views.gte("created_at", sinceIso);
        clicks = clicks.gte("created_at", sinceIso);
      }
      const [v, c] = await Promise.all([views, clicks]);
      result.get(id)!.views = v.count ?? 0;
      result.get(id)!.clicks = c.count ?? 0;
    }),
  ]);
  for (const r of (salesRes.data ?? []) as { event_id: string; quantity: number }[]) {
    const t = result.get(r.event_id);
    if (t) t.tickets += Number(r.quantity);
  }
  return result;
}

export function sumTotals(totals: Iterable<EventTotals>): EventTotals {
  const s = { views: 0, clicks: 0, tickets: 0 };
  for (const t of totals) {
    s.views += t.views;
    s.clicks += t.clicks;
    s.tickets += t.tickets;
  }
  return s;
}

/** "Del 7 al 20 de noviembre" */
export function rangeLabel(from: Date, to: Date) {
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const a = lpParts(from);
  const b = lpParts(to);
  if (a.month === b.month) return `Del ${a.day} al ${b.day} de ${months[b.month]}`;
  return `Del ${a.day} de ${months[a.month]} al ${b.day} de ${months[b.month]}`;
}
