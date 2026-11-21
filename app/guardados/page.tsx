import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Poster } from "@/components/Poster";
import { SiteHeader } from "@/components/SiteHeader";
import { formatPrice, formatWhen } from "@/lib/format";
import { getUser } from "@/lib/supabase/server";
import type { TilcaEvent } from "@/lib/types";

export const metadata: Metadata = { title: "Mis guardados" };

export default async function GuardadosPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/entrar?next=/guardados");

  const { data } = await supabase
    .from("saves")
    .select("created_at, events(id, title, category, poster_url, starts_at, ends_at, venue_name, venue_zone, price, status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const events = (data ?? [])
    .map((r) => r.events as unknown as TilcaEvent | null)
    .filter((e): e is TilcaEvent => !!e && e.status === "publicado");

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-6">
        <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Mis guardados</h1>
        {events.length === 0 ? (
          <p className="mt-3 text-[15px] text-ink-2">
            Todavía no guardaste eventos.{" "}
            <Link href="/" className="link-underline font-semibold text-ink">
              Mira lo que hay esta semana
            </Link>
          </p>
        ) : (
          <ul className="mt-5 list-none p-0">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/evento/${e.id}`} className="flex gap-3.5 border-t border-line py-3.5 hover:bg-fog">
                  <Poster title={e.title} category={e.category} posterUrl={e.poster_url} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-base font-semibold">{e.title}</span>
                    <span className="text-sm text-ink-2">
                      {e.venue_name}
                      {e.venue_zone ? `, ${e.venue_zone}` : ""}
                    </span>
                    <span className="text-sm text-ink-2">{formatWhen(e)}</span>
                  </span>
                  <span className="text-[15px] font-semibold whitespace-nowrap">{formatPrice(e.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
