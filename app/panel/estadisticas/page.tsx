import Link from "next/link";
import { redirect } from "next/navigation";
import { hoursAgo } from "@/lib/format";
import { requireOrganizer } from "@/lib/organizer";

/** "Estadísticas" en el menú: abre el próximo evento publicado (o el último). */
export default async function StatsIndex() {
  const { supabase, organizer } = await requireOrganizer();
  const now = hoursAgo(3).toISOString();
  const base = () =>
    supabase.from("events").select("id").eq("organizer_id", organizer.id).eq("status", "publicado").limit(1);
  const { data: next } = await base().gte("starts_at", now).order("starts_at", { ascending: true }).maybeSingle();
  const target = next ?? (await base().order("starts_at", { ascending: false }).maybeSingle()).data;
  if (target) redirect(`/panel/evento/${target.id}`);

  return (
    <div className="panel max-w-[560px] p-6">
      <h1 className="font-condensed m-0 text-[32px] leading-none font-extrabold">Estadísticas</h1>
      <p className="mt-2 mb-4 text-[15px] text-ink-2">Cuando publiques tu primer evento, aquí verás cuánta gente te trae TILCA.</p>
      <Link href="/panel/evento/nuevo" className="btn-primary h-11 px-[18px] text-[15px]">
        Publicar un evento
      </Link>
    </div>
  );
}
