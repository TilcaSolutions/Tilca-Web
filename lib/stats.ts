import type { SupabaseClient } from "@supabase/supabase-js";
import { CHANNELS, type Channel } from "./constants";
import { lpParts } from "./format";
import { lpMidnight } from "./time-filters";

export interface ClickRow {
  id?: number | string;
  code: string;
  channel: Channel | null;
  created_at: string;
  redeemed_at: string | null;
  is_new_audience: boolean | null;
  is_sample: boolean;
  charge_status?: string | null;
  stellar_tx_hash?: string | null;
  charge_error?: string | null;
}

export interface EventStats {
  views: number;
  clicks: number;
  tickets: number;
  newAudience: number;
  channels: { id: Channel | "directo"; label: string; count: number }[];
  days: { date: Date; count: number; topChannel: Channel | null }[];
  codes: ClickRow[];
}

export type Period = "7" | "todo";

/** Carga vistas y clics de un evento (el RLS solo deja ver los del dueño). */
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

  const [viewsRes, clicksRes, codesRes] = await Promise.all([
    supabase
      .from("views")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("clicks")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("clicks")
      .select("id, code, channel, created_at, redeemed_at, is_new_audience, is_sample, charge_status, stellar_tx_hash, charge_error")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const codes = (codesRes.data ?? []) as ClickRow[];
  const redeemed = codes.filter((c) => c.redeemed_at && new Date(c.redeemed_at) >= since);

  const byChannel = new Map<string, number>();
  for (const c of redeemed) byChannel.set(c.channel ?? "directo", (byChannel.get(c.channel ?? "directo") ?? 0) + 1);
  const channels: EventStats["channels"] = CHANNELS.map((ch) => ({
    id: ch.id,
    label: ch.label,
    count: byChannel.get(ch.id) ?? 0,
  }));
  if (byChannel.get("directo")) channels.push({ id: "directo", label: "Link directo", count: byChannel.get("directo")! });

  // Entradas por día (hora de La Paz), desde `since` hasta hoy.
  const totalDays = Math.min(60, Math.max(1, Math.round((lpMidnight(now, 1).getTime() - since.getTime()) / 86_400_000)));
  const firstDay = lpMidnight(now, -(totalDays - 1));
  const days: EventStats["days"] = Array.from({ length: totalDays }, (_, i) => ({
    date: new Date(firstDay.getTime() + i * 86_400_000),
    count: 0,
    topChannel: null,
  }));
  const dayChannels = days.map(() => new Map<Channel, number>());
  for (const c of redeemed) {
    const idx = Math.floor((lpMidnight(new Date(c.redeemed_at!)).getTime() - firstDay.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days.length) {
      days[idx].count++;
      if (c.channel) dayChannels[idx].set(c.channel, (dayChannels[idx].get(c.channel) ?? 0) + 1);
    }
  }
  days.forEach((d, i) => {
    let best: Channel | null = null;
    let bestN = 0;
    for (const [ch, n] of dayChannels[i]) if (n > bestN) [best, bestN] = [ch, n];
    d.topChannel = bestN > d.count / 2 ? best : null;
  });

  return {
    views: viewsRes.count ?? 0,
    clicks: clicksRes.count ?? 0,
    tickets: redeemed.length,
    newAudience: redeemed.filter((c) => c.is_new_audience).length,
    channels,
    days,
    codes,
  };
}

export interface EventTotals {
  views: number;
  clicks: number;
  tickets: number;
  newAudience: number;
}

/** Totales por evento (y opcionalmente desde una fecha) para la tabla y el resumen. */
export async function loadTotals(
  supabase: SupabaseClient,
  eventIds: string[],
  since?: Date,
): Promise<Map<string, EventTotals>> {
  const result = new Map<string, EventTotals>();
  if (!eventIds.length) return result;
  for (const id of eventIds) result.set(id, { views: 0, clicks: 0, tickets: 0, newAudience: 0 });

  const sinceIso = since?.toISOString();
  await Promise.all(
    eventIds.map(async (id) => {
      let views = supabase.from("views").select("id", { count: "exact", head: true }).eq("event_id", id);
      let clicks = supabase.from("clicks").select("id", { count: "exact", head: true }).eq("event_id", id);
      let tickets = supabase
        .from("clicks")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id)
        .not("redeemed_at", "is", null);
      let fresh = supabase
        .from("clicks")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id)
        .not("redeemed_at", "is", null)
        .eq("is_new_audience", true);
      if (sinceIso) {
        views = views.gte("created_at", sinceIso);
        clicks = clicks.gte("created_at", sinceIso);
        tickets = tickets.gte("redeemed_at", sinceIso);
        fresh = fresh.gte("redeemed_at", sinceIso);
      }
      const [v, c, t, n] = await Promise.all([views, clicks, tickets, fresh]);
      result.set(id, { views: v.count ?? 0, clicks: c.count ?? 0, tickets: t.count ?? 0, newAudience: n.count ?? 0 });
    }),
  );
  return result;
}

export function sumTotals(totals: Iterable<EventTotals>): EventTotals {
  const s = { views: 0, clicks: 0, tickets: 0, newAudience: 0 };
  for (const t of totals) {
    s.views += t.views;
    s.clicks += t.clicks;
    s.tickets += t.tickets;
    s.newAudience += t.newAudience;
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
