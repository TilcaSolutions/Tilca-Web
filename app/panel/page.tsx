import type { Metadata } from "next";
import Link from "next/link";
import { Poster } from "@/components/Poster";
import { SlowSalesAlert } from "@/components/panel/SlowSalesAlert";
import { salesPace } from "@/lib/benchmark";
import { COMISION_LABEL, commissionFor } from "@/lib/constants";
import { formatBs, formatCount, formatShort } from "@/lib/format";
import { requireOrganizer } from "@/lib/organizer";
import { loadTotals, sumTotals } from "@/lib/stats";
import { EVENT_COLUMNS, type TilcaEvent } from "@/lib/types";
import { shortVenue } from "@/lib/venues";

export const metadata: Metadata = { title: "Mis eventos" };

type Tab = "todos" | "proximos" | "borradores" | "pasados";
const TABS: { id: Tab; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "proximos", label: "Próximos" },
  { id: "borradores", label: "Borradores" },
  { id: "pasados", label: "Pasados" },
];

function kind(e: TilcaEvent, now: Date): Exclude<Tab, "todos"> {
  if (e.status === "borrador") return "borradores";
  const end = new Date(e.ends_at ?? e.starts_at!);
  return end < new Date(now.getTime() - 3 * 3600 * 1000) ? "pasados" : "proximos";
}

function missingFields(e: TilcaEvent) {
  const missing = [
    !e.starts_at && "la fecha",
    (e.lat === null || !e.venue_name) && "el lugar",
    e.price === null && "el precio",
    !e.poster_url && "el afiche",
  ].filter(Boolean) as string[];
  if (!missing.length) return "Listo para publicar";
  if (missing.length === 1) return `Falta ${missing[0]}`;
  return `Falta ${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`;
}

export default async function PanelPage({ searchParams }: PageProps<"/panel">) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "todos";
  const { supabase, organizer } = await requireOrganizer();
  const now = new Date();

  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false, nullsFirst: true })
    .returns<TilcaEvent[]>();
  const events = data ?? [];

  const publishedIds = events.filter((e) => e.status === "publicado").map((e) => e.id);
  const [allTime, last30, { data: requests }] = await Promise.all([
    loadTotals(supabase, publishedIds),
    loadTotals(supabase, publishedIds, new Date(now.getTime() - 30 * 86_400_000)),
    supabase.from("feature_requests").select("event_id").eq("organizer_id", organizer.id).eq("status", "pendiente"),
  ]);
  const summary = sumTotals(last30.values());
  // Comisión sobre las ventas confirmadas de los últimos 30 días (5% del precio de cada entrada).
  const commission30 = events.reduce((sum, e) => sum + commissionFor(last30.get(e.id)?.tickets ?? 0, Number(e.price ?? 0)), 0);
  const requested = new Set((requests ?? []).map((r) => r.event_id as string));

  // Aviso: el próximo evento que más se atrasa respecto a eventos parecidos.
  const slow = events
    .filter((e) => kind(e, now) === "proximos")
    .map((e) => ({ e, pace: salesPace(Math.max(e.tickets_sold, allTime.get(e.id)?.tickets ?? 0), e.capacity, e.starts_at, now) }))
    .filter((x) => x.pace?.slow)
    .sort((a, b) => a.pace!.pct / a.pace!.expected - b.pace!.pct / b.pace!.expected)[0];

  const counts = { todos: events.length, proximos: 0, borradores: 0, pasados: 0 } as Record<Tab, number>;
  for (const e of events) counts[kind(e, now)]++;
  const shown = tab === "todos" ? events : events.filter((e) => kind(e, now) === tab);

  const stat = "flex-1 px-[22px] py-[18px] transition-colors hover:bg-fog/40";
  const statNum = "font-condensed mt-1.5 text-[34px] leading-none font-bold tabular";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Mis eventos</h1>
          <p className="mt-2 mb-0 text-[15px] text-ink-2">Resultados de los últimos 30 días</p>
        </div>
        <Link href="/panel/evento/nuevo" className="btn-primary h-11 px-[18px] text-[15px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Publicar un evento
        </Link>
      </div>

      <section aria-label="Resumen" className="panel grid grid-cols-2 lg:flex">
        <div className={stat}>
          <div className="text-sm text-ink-2">Vieron tus eventos</div>
          <div className={statNum}>{formatCount(summary.views)}</div>
        </div>
        <div className={`${stat} border-l border-line`}>
          <div className="text-sm text-ink-2">Hicieron clic en comprar</div>
          <div className={statNum}>{formatCount(summary.clicks)}</div>
        </div>
        <div className={`${stat} border-t border-line lg:border-t-0 lg:border-l`}>
          <div className="text-sm text-ink-2">Ventas confirmadas con código TILCA</div>
          <div className={statNum}>{formatCount(summary.tickets)}</div>
        </div>
        <div className={`${stat} border-t border-l border-line lg:border-t-0`}>
          <div className="text-sm text-ink-2">Comisión TILCA ({COMISION_LABEL})</div>
          <div className={statNum}>{formatBs(commission30)}</div>
        </div>
      </section>

      {slow && <SlowSalesAlert title={slow.e.title} eventId={slow.e.id} pace={slow.pace!} requested={requested.has(slow.e.id)} />}

      <section aria-label="Lista de eventos" className="panel overflow-hidden">
        <nav aria-label="Filtrar eventos" className="flex gap-6 overflow-x-auto border-b border-line px-5 text-[15px] [scrollbar-width:none]">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Link
                key={t.id}
                href={t.id === "todos" ? "/panel" : `/panel?tab=${t.id}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-12 flex-none items-center gap-1.5 ${on ? "font-semibold shadow-[inset_0_-2px_0_var(--color-primary)] text-primary" : "text-ink-2 hover:text-ink"}`}
                scroll={false}
              >
                {t.label} <span className="font-normal text-ink-3">{counts[t.id]}</span>
              </Link>
            );
          })}
        </nav>

        {shown.length === 0 ? (
          <div className="px-5 py-10 text-[15px] text-ink-2">
            {events.length === 0 ? (
              <>
                <p className="m-0 font-semibold text-ink">Todavía no publicaste eventos.</p>
                <p className="mt-1 mb-0">Publica el primero y aparecerá en el mapa de TILCA.</p>
              </>
            ) : (
              <p className="m-0">No hay eventos en esta pestaña.</p>
            )}
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[15px] tabular">
              <thead>
                <tr className="text-left text-[13px] text-ink-2">
                  <th scope="col" className="px-5 py-3 font-medium">Evento</th>
                  <th scope="col" className="p-3 font-medium">Estado</th>
                  <th scope="col" className="p-3 text-right font-medium">Vistas</th>
                  <th scope="col" className="p-3 text-right font-medium">Clics en comprar</th>
                  <th scope="col" className="p-3 text-right font-medium">Ventas con código</th>
                  <th scope="col" className="w-[150px] px-5 py-3 font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const k = kind(e, now);
                  const t = allTime.get(e.id);
                  const past = k === "pasados";
                  return (
                    <tr key={e.id} className={`border-t border-line transition-colors hover:bg-fog/50 ${past ? "text-ink-2" : ""}`}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          {k === "borradores" && !e.poster_url ? (
                            <span aria-hidden="true" className="h-[46px] w-[34px] flex-none rounded-[3px] border border-dashed border-muted" />
                          ) : (
                            <Poster title={e.title} category={e.category} posterUrl={e.poster_url} size="xs" muted={past} />
                          )}
                          <span className="flex min-w-0 flex-col">
                            <strong className="font-semibold text-ink">{e.title}</strong>
                            <span className="text-sm text-ink-2">
                              {k === "borradores"
                                ? missingFields(e)
                                : `${formatShort(e.starts_at!).split(",")[0]}, ${shortVenue(e.venue_name)}`}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
                          {k === "borradores" ? (
                            <span aria-hidden="true" className="h-2 w-2 rounded-full border-2 border-muted" />
                          ) : (
                            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${past ? "bg-muted" : "bg-ok"}`} />
                          )}
                          {k === "borradores" ? "Borrador" : past ? "Terminado" : "Publicado"}
                        </span>
                      </td>
                      {k === "borradores" ? (
                        <>
                          <td className="p-3 text-right text-ink-3">–</td>
                          <td className="p-3 text-right text-ink-3">–</td>
                          <td className="p-3 text-right text-ink-3">–</td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 text-right">{formatCount(t?.views ?? 0)}</td>
                          <td className="p-3 text-right">{formatCount(t?.clicks ?? 0)}</td>
                          <td className="p-3 text-right font-semibold text-ink">{formatCount(t?.tickets ?? 0)}</td>
                        </>
                      )}
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {k === "borradores" ? (
                          <Link href={`/panel/evento/${e.id}/editar`} className="link-underline text-sm font-semibold text-ink">
                            Terminar borrador
                          </Link>
                        ) : (
                          <Link href={`/panel/evento/${e.id}`} className="link-underline text-sm font-semibold text-ink">
                            Ver estadísticas
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
