import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CopyCode } from "@/components/event/CopyCode";
import { createClient } from "@/lib/supabase/server";
import { formatLong, ticketSiteName } from "@/lib/format";

export const metadata: Metadata = { title: "Tu código TILCA", robots: { index: false } };

export default async function CodePage({ params, searchParams }: PageProps<"/codigo/[code]">) {
  const { code } = await params;
  const { e } = await searchParams;
  if (!/^TILCA-[0-9A-Z]{4}$/.test(code) || typeof e !== "string" || !/^[0-9a-f-]{36}$/i.test(e)) notFound();

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, ticket_url, venue_name")
    .eq("id", e)
    .maybeSingle();
  if (!event) notFound();

  const site = ticketSiteName(event.ticket_url) ?? "la ticketera";

  return (
    <div className="flex min-h-dvh flex-col bg-fog">
      <header className="flex h-16 items-center border-b border-line bg-white px-4 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="panel w-full max-w-[440px] p-6 sm:p-8">
          <p className="m-0 text-sm text-ink-2">{event.title}</p>
          {event.starts_at && (
            <p className="m-0 mt-0.5 text-sm text-ink-2">
              {formatLong(event.starts_at)}, {event.venue_name}
            </p>
          )}
          <h1 className="font-condensed mt-5 mb-0 text-[32px] leading-none font-extrabold tracking-[-0.5px]">
            Este es tu código TILCA
          </h1>
          <p className="mt-2 mb-0 text-[15px] leading-normal text-ink-2">
            Úsalo al comprar en {site} o muéstralo en boletería. Así el organizador sabe que llegaste por TILCA.
          </p>

          <CopyCode code={code} />

          {event.ticket_url ? (
            <a href={event.ticket_url} rel="noopener" className="btn-primary mt-5 h-12 w-full text-base">
              Seguir a {site} para comprar
            </a>
          ) : (
            <p className="mt-5 text-[15px] text-ink-2">Este evento no vende entradas en línea: muestra el código en la puerta.</p>
          )}
          <Link href={`/evento/${event.id}`} className="btn-secondary mt-2.5 h-12 w-full text-[15px]">
            Volver al evento
          </Link>
          <p className="mt-4 mb-0 text-[13px] leading-normal text-ink-3">
            Guarda una captura de esta pantalla. El código es solo para esta compra.
          </p>
        </div>
      </main>
    </div>
  );
}
