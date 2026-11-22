import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileEvent } from "@/components/profile/ProfileView";
import { hoursAgo } from "@/lib/format";

const COLUMNS = "id, title, category, subcategory, poster_url, starts_at, ends_at, venue_name, venue_zone, price";

/** Eventos publicados del organizador: próximos (incluye exposiciones abiertas) y los últimos 6 pasados. */
export async function loadProfileEvents(supabase: SupabaseClient, organizerId: string) {
  const cutoff = hoursAgo(3).toISOString();
  const { data } = await supabase
    .from("events")
    .select(COLUMNS)
    .eq("organizer_id", organizerId)
    .eq("status", "publicado")
    .not("starts_at", "is", null)
    .order("starts_at", { ascending: true })
    .limit(200)
    .returns<ProfileEvent[]>();
  const events = data ?? [];
  const isUpcoming = (e: ProfileEvent) => (e.ends_at ?? e.starts_at) >= cutoff;
  return {
    upcoming: events.filter(isUpcoming).slice(0, 12),
    past: events.filter((e) => !isUpcoming(e)).reverse().slice(0, 6),
  };
}
