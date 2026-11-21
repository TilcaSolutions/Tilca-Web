import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Poster } from "@/components/Poster";
import { SaveButton } from "@/components/event/SaveButton";
import { ShareButton } from "@/components/event/ShareButton";
import { ViewTracker } from "@/components/event/ViewTracker";
import { LocationMap } from "@/components/map/ClientMaps";
import { categoryInfo, parseChannel } from "@/lib/constants";
import {
  currentPrice,
  formatLong,
  formatPrice,
  formatWeekdayDay,
  formatDayMonth,
  hoursAgo,
  isPresaleActive,
  plural,
  ticketSiteName,
} from "@/lib/format";
import { createClient, getUser } from "@/lib/supabase/server";
import { EVENT_COLUMNS, type TilcaEvent } from "@/lib/types";

async function loadEvent(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle<TilcaEvent>();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/evento/[id]">): Promise<Metadata> {
  const { id } = await params;
  const e = await loadEvent(id);
  if (!e) return { title: "Evento no encontrado" };
  const when = e.starts_at ? formatLong(e.starts_at) : "";
  return {
    title: e.title,
    description: `${when}, ${e.venue_name ?? ""}. ${formatPrice(e.price)}.`,
    openGraph: { title: e.title, images: e.poster_url ? [e.poster_url] : undefined },
  };
}

export default async function EventPage({ params, searchParams }: PageProps<"/evento/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const channel = parseChannel(sp.c);

  const event = await loadEvent(id);
  if (!event || !event.starts_at) notFound();

  const { supabase, user } = await getUser();
  const [{ data: saveCount }, savedRow] = await Promise.all([
    supabase.rpc("event_save_count", { p_event: event.id }),
    user
      ? supabase.from("saves").select("event_id").eq("event_id", event.id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const cat = categoryInfo(event.category);
  const organizer = event.organizers?.name ?? null;
  const price = currentPrice(event);
  const presale = isPresaleActive(event);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const shareUrl = `${site}/evento/${event.id}?c=amigo`;
  const buyHref = `/r/${event.id}${channel ? `?c=${channel}` : ""}`;
  const ticketSite = ticketSiteName(event.ticket_url);
  const isPast = new Date(event.ends_at ?? event.starts_at) < hoursAgo(3);
  const isDraft = event.status !== "publicado";
  const exhibitionOpen = event.ends_at && new Date(event.starts_at) <= new Date();
  const saves = Number(saveCount ?? 0);

  const rowDt = "border-t border-line/80 py-3 text-ink-2 font-medium";
  const rowDd = "m-0 border-t border-line/80 py-3 text-ink";

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh">
      <SiteHeader />
      {!isDraft && <ViewTracker eventId={event.id} channel={channel} />}
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <article className="animate-fade-in flex min-w-0 flex-col border-line bg-surface md:flex-none md:basis-[520px] md:overflow-y-auto md:border-r">
          <div className="px-4 pt-3.5 sm:px-6">
            <Link
              href="/"
              className="group inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="transition-transform group-hover:-translate-x-1"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>Volver al mapa</span>
            </Link>
          </div>

          {(isDraft || isPast) && (
            <p role="status" className="mx-4 mt-2 rounded-control border border-warn-line bg-warn-bg px-3.5 py-2.5 text-sm font-medium text-warn-ink sm:mx-6 shadow-xs">
              {isDraft ? "Este evento es un borrador: solo tú puedes verlo." : "Este evento ya pasó."}
            </p>
          )}

          <div className="mx-4 mt-2 flex gap-4 sm:mx-6 sm:gap-5">
            <div className="hidden flex-none sm:block rounded-md shadow-[0_12px_28px_rgba(23,25,30,0.14)] overflow-hidden transition-transform hover:scale-[1.02] duration-300">
              <Poster
                title={event.title}
                category={event.category}
                posterUrl={event.poster_url}
                size="lg"
                organizer={organizer}
                startsAt={exhibitionOpen ? null : event.starts_at}
                venue={event.venue_name}
              />
            </div>
            <div className="flex-none sm:hidden rounded-md shadow-[0_8px_20px_rgba(23,25,30,0.14)] overflow-hidden">
              <Poster
                title={event.title}
                category={event.category}
                posterUrl={event.poster_url}
                size="md"
                organizer={organizer}
                startsAt={exhibitionOpen ? null : event.starts_at}
                venue={event.venue_name}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-fog px-2.5 py-1 text-xs font-semibold text-ink border border-line/60">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.label}
                  {event.subcategory ? ` · ${event.subcategory}` : ""}
                </span>
              </div>
              <h1 className="font-condensed m-0 text-[28px] leading-[0.98] font-extrabold tracking-[-0.5px] sm:text-[38px] text-ink">
                {event.title}
              </h1>
              {organizer && <span className="text-[15px] font-medium text-ink-2">{organizer}</span>}
              {event.is_sample && (
                <span className="self-start rounded bg-fog px-2 py-0.5 text-[12px] font-medium text-ink-3">
                  Evento de ejemplo
                </span>
              )}
              {event.trailer_url && (
                <a
                  href={event.trailer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary mt-auto h-9 self-start px-3 text-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#17191E" aria-hidden="true">
                    <path d="M7 4v16l13-8z" />
                  </svg>
                  Ver adelanto
                </a>
              )}
            </div>
          </div>

          <dl className="mx-4 mt-6 grid grid-cols-[96px_1fr] text-[15px] sm:mx-6">
            <dt className={rowDt}>Fecha</dt>
            <dd className={rowDd}>
              {exhibitionOpen ? (
                <strong className="font-semibold text-ink">Abierta hasta el {formatDayMonth(event.ends_at!)}</strong>
              ) : (
                <strong className="font-semibold text-ink">{formatLong(event.starts_at)}</strong>
              )}
              {event.ends_at && !exhibitionOpen && (
                <>
                  <br />
                  <span className="text-ink-2">Hasta el {formatDayMonth(event.ends_at)}</span>
                </>
              )}
              {event.duration_min && (
                <>
                  <br />
                  <span className="text-ink-2">Dura {event.duration_min} minutos</span>
                </>
              )}
            </dd>
            <dt className={rowDt}>Lugar</dt>
            <dd className={rowDd}>
              <strong className="font-semibold text-ink">{event.venue_name}</strong>
              {(event.venue_address || event.venue_zone) && (
                <>
                  <br />
                  <span className="text-ink-2">{[event.venue_address, event.venue_zone].filter(Boolean).join(", ")}</span>
                </>
              )}
            </dd>
            <dt className={`${rowDt} border-b`}>Precio</dt>
            <dd className={`${rowDd} border-b`}>
              <strong className="font-semibold text-ink">{formatPrice(event.price)}</strong>
              {presale && (
                <>
                  <br />
                  <span className="text-ink-2 font-medium">
                    {formatPrice(event.presale_price)} en preventa hasta el {formatWeekdayDay(event.presale_until!)}
                  </span>
                </>
              )}
            </dd>
          </dl>

          {event.description && (
            <p className="mx-4 mt-[18px] max-w-[62ch] text-[15px] leading-[1.6] whitespace-pre-line text-ink-2 sm:mx-6">
              {event.description}
            </p>
          )}

          {saves > 0 && (
            <div className="mx-4 mt-4 flex items-center gap-2 text-sm text-ink-2 sm:mx-6">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fog text-accent">
                ♥
              </span>
              <span>
                <strong className="font-semibold text-ink">{plural(saves, "persona lo guardó.", "personas lo guardaron.")}</strong>
              </span>
            </div>
          )}

          <div className="glass-header sticky bottom-0 mt-auto flex flex-col gap-2.5 border-t border-line/80 px-4 pt-4 pb-5 sm:px-6 md:static md:bg-transparent md:backdrop-filter-none">
            <div className="flex flex-wrap gap-2">
              {event.ticket_url && !isPast ? (
                <a
                  href={buyHref}
                  className="btn-primary h-12 min-w-0 flex-1 basis-full px-4 text-base whitespace-nowrap"
                >
                  {price === 0 ? "Reservar entrada" : `Comprar entrada · ${formatPrice(price)}`}
                </a>
              ) : (
                <span className="flex h-12 min-w-0 flex-1 basis-full items-center justify-center rounded-control bg-fog px-3 text-[15px] font-semibold text-ink-2 border border-line/60">
                  {isPast ? "Este evento ya pasó" : "Entrada libre, sin reserva"}
                </span>
              )}
              <SaveButton eventId={event.id} userId={user?.id ?? null} initialSaved={!!savedRow.data} />
              <ShareButton title={event.title} url={shareUrl} />
            </div>
            {event.ticket_url && (
              <span className="text-[13px] text-ink-3">
                {event.source
                  ? `Datos tomados de ${ticketSite ?? "la ticketera"}: la compra y el precio final se confirman allí.`
                  : `La compra se realiza en ${ticketSite ?? "la ticketera del organizador"}. TILCA solo registra tu código.`}
              </span>
            )}
          </div>
        </article>

        {event.lat !== null && event.lng !== null && (
          <section aria-label="Ubicación del evento" className="relative h-[320px] min-w-0 overflow-hidden bg-map md:h-auto md:flex-1">
            <LocationMap lat={event.lat} lng={event.lng} title={event.title} venue={event.venue_name ?? ""} />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-pill absolute top-4 left-4 z-[1000] flex h-10 items-center gap-1.5 rounded-control px-3.5 text-sm font-semibold text-white shadow-md hover:bg-black transition-all sm:top-5 sm:left-5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Google Maps
            </a>
          </section>
        )}
      </main>
    </div>
  );
}
