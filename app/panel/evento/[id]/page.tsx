import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unredeemCode, updateTicketsSold } from "@/app/panel/actions";
import { CodesManager } from "@/components/panel/CodesManager";
import { Simulator } from "@/components/panel/Simulator";
import { FeatureButton } from "@/components/panel/SlowSalesAlert";
import { TicketsChart } from "@/components/panel/TicketsChart";
import { salesPace, weeksLabel } from "@/lib/benchmark";
import { CHANNELS, PRICE_PER_NEW_ATTENDEE } from "@/lib/constants";
import { formatCount, formatLong, formatPrice, formatShort, formatWeekdayDay, isPresaleActive, percent } from "@/lib/format";
import { requireOrganizer } from "@/lib/organizer";
import { loadEventStats, rangeLabel, type Period, type ClickRow } from "@/lib/stats";
import { EVENT_COLUMNS, type TilcaEvent } from "@/lib/types";
import { explorerTxUrl } from "@/lib/stellar/config";
import { shortVenue } from "@/lib/venues";

export const metadata: Metadata = { title: "Estadísticas del evento" };

export default async function EventStatsPage({ params, searchParams }: PageProps<"/panel/evento/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const period: Period = sp.periodo === "7" ? "7" : "todo";
  const { supabase, organizer } = await requireOrganizer();

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: event } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .maybeSingle<TilcaEvent>();
  if (!event) notFound();

  const [stats, allTime, { data: request }] = await Promise.all([
    loadEventStats(supabase, event.id, period, event.published_at),
    period === "todo" ? null : loadEventStats(supabase, event.id, "todo", event.published_at),
    supabase.from("feature_requests").select("id").eq("event_id", event.id).eq("status", "pendiente").maybeSingle(),
  ]);
  const totals = allTime ?? stats;
  const sold = Math.max(event.tickets_sold, totals.tickets);
  const pace = salesPace(sold, event.capacity, event.starts_at);
  const maxChannel = Math.max(...stats.channels.map((c) => c.count), 1);
  const presale = isPresaleActive(event);
  const firstDay = stats.days[0]?.date;
  const lastDay = stats.days.at(-1)?.date;

  const card = "panel flex min-w-0 flex-1 flex-col gap-3.5 px-5 py-5 sm:px-[22px]";
  const periodBtn = "flex h-8 items-center rounded-[6px] px-3 text-sm whitespace-nowrap";
  const periodOn = `${periodBtn} bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(23,25,30,0.18)]`;
  const periodOff = `${periodBtn} text-ink-2 hover:text-ink`;

  const funnel = [
    { label: "Vieron la ficha del evento", value: stats.views, rate: null as number | null },
    { label: "Hicieron clic en comprar", value: stats.clicks, rate: percent(stats.clicks, stats.views) },
    { label: "Compraron con el código TILCA", value: stats.tickets, rate: percent(stats.tickets, stats.clicks) },
  ];

  return (
    <>
      {sp.publicado === "1" && (
        <p role="status" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-[#B8DCC8] bg-[#EAF6EF] px-[18px] py-3 text-[15px] text-[#14532D]">
          <strong className="font-semibold">Tu evento ya está en el mapa.</strong>
          <Link href={`/evento/${event.id}`} className="link-underline font-semibold">
            Ver la ficha pública
          </Link>
        </p>
      )}

      <div>
        <nav aria-label="Ruta" className="text-sm text-ink-2">
          <Link href="/panel" className="link-underline">
            Mis eventos
          </Link>{" "}
          <span aria-hidden="true">/</span> {event.title}
        </nav>
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-condensed m-0 text-[34px] leading-none font-extrabold tracking-[-0.5px] sm:text-[40px]">{event.title}</h1>
            <p className="mt-2 mb-0 text-[15px] text-ink-2">
              {event.starts_at ? formatLong(event.starts_at) : "Sin fecha"}
              {event.venue_name ? `, en ${event.venue_name.startsWith("Teatro") ? "el " : ""}${shortVenue(event.venue_name)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div role="group" aria-label="Periodo" className="flex rounded-control bg-line p-[3px]">
              <Link href={`/panel/evento/${event.id}?periodo=7`} aria-current={period === "7" ? "true" : undefined} className={period === "7" ? periodOn : periodOff} scroll={false}>
                Últimos 7 días
              </Link>
              <Link href={`/panel/evento/${event.id}`} aria-current={period === "todo" ? "true" : undefined} className={period === "todo" ? periodOn : periodOff} scroll={false}>
                Desde que se publicó
              </Link>
            </div>
            <Link href={`/panel/evento/${event.id}/presupuesto`} className="btn-secondary h-[38px] px-3.5 text-sm inline-flex items-center gap-1.5 border-accent/40 font-semibold text-accent hover:border-accent">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Presupuesto y cobros
            </Link>
            <Link href={`/evento/${event.id}`} className="btn-secondary h-[38px] px-3.5 text-sm">
              Ver ficha pública
            </Link>
            <Link href={`/panel/evento/${event.id}/editar`} className="btn-secondary h-[38px] px-3.5 text-sm">
              Editar
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <section className={card} aria-labelledby="h-vendidas">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="h-vendidas" className="m-0 text-base font-semibold">
              Entradas vendidas
            </h2>
            {pace && <span className="text-sm text-ink-2">{capitalize(weeksLabel(pace.daysLeft))}</span>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-condensed text-[40px] leading-none font-bold tabular">{formatCount(sold)}</span>
            {event.capacity ? (
              <span className="text-base text-ink-2">
                de {formatCount(event.capacity)}, el {percent(sold, event.capacity)}%
              </span>
            ) : (
              <span className="text-base text-ink-2">sin aforo definido</span>
            )}
          </div>
          {event.capacity && (
            <div className="relative pt-[22px]">
              <div
                className="h-3 overflow-hidden rounded-[4px] bg-line"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={event.capacity}
                aria-valuenow={Math.min(sold, event.capacity)}
                aria-label="Entradas vendidas sobre el aforo"
              >
                <div className="h-full bg-ink" style={{ width: `${Math.min(100, percent(sold, event.capacity))}%` }} />
              </div>
              {pace && (
                <>
                  <span aria-hidden="true" className="absolute top-4 h-6 w-0.5 bg-warn-strong" style={{ left: `${pace.expected}%` }} />
                  <span
                    className="absolute top-0 text-xs whitespace-nowrap text-warn-ink"
                    style={{ left: `${pace.expected}%`, transform: pace.expected > 75 ? "translateX(-100%)" : "translateX(-50%)" }}
                  >
                    Eventos parecidos: {pace.expected}%
                  </span>
                </>
              )}
            </div>
          )}
          <div className="mt-0.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="max-w-[38ch] text-sm text-ink-2">
              {pace
                ? pace.slow
                  ? `Vas por debajo de lo normal.${presale ? ` La preventa a ${formatPrice(event.presale_price)} termina el ${formatWeekdayDay(event.presale_until!)}.` : ""}`
                  : "Vas a buen ritmo comparado con eventos parecidos."
                : "Incluye las entradas vendidas por fuera de TILCA."}
            </span>
            {pace?.slow && <FeatureButton eventId={event.id} requested={!!request} variant="primary" />}
          </div>
          <form action={updateTicketsSold} className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <input type="hidden" name="event_id" value={event.id} />
            <label htmlFor="tickets_sold" className="text-sm text-ink-2">
              Total vendido en tu ticketera
            </label>
            <input
              id="tickets_sold"
              name="tickets_sold"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={event.tickets_sold}
              className="field h-9 w-24 text-sm tabular"
            />
            <button type="submit" className="btn-secondary h-9 px-3 text-sm">
              Actualizar
            </button>
          </form>
        </section>

        <section className={card} aria-labelledby="h-embudo">
          <h2 id="h-embudo" className="m-0 text-base font-semibold">
            Del clic a la entrada
          </h2>
          <div className="grid grid-cols-[1fr_64px] items-center gap-x-3 gap-y-1 text-sm tabular">
            {funnel.map((f, i) => (
              <FunnelRow key={f.label} {...f} first={i === 0} width={stats.views ? (f.value / stats.views) * 100 : 0} />
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <section className="panel min-w-0 px-5 pt-5 pb-3.5 sm:px-[22px] lg:flex-[3]" aria-labelledby="h-dias">
          <h2 id="h-dias" className="m-0 text-base font-semibold">
            Entradas vendidas por TILCA, por día
          </h2>
          <p className="mt-1 mb-1.5 text-sm text-ink-2">
            {firstDay && lastDay ? rangeLabel(firstDay, lastDay) : ""}. {formatCount(stats.tickets)} en total.
          </p>
          <TicketsChart days={stats.days} />
        </section>

        <section className="panel flex min-w-0 flex-col gap-3 px-5 py-5 sm:px-[22px] lg:flex-[2]" aria-labelledby="h-canales">
          <h2 id="h-canales" className="m-0 text-base font-semibold">
            De dónde vino la gente que compró
          </h2>
          <div className="grid grid-cols-[150px_1fr_28px] items-center gap-x-2.5 gap-y-3 text-sm tabular">
            {stats.channels.map((c) => (
              <ChannelRow key={c.id} label={c.label} count={c.count} max={maxChannel} />
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3.5">
            <span className="text-sm leading-[1.45] text-ink-2">
              <strong className="font-semibold text-ink">
                {formatCount(stats.newAudience)} de {formatCount(stats.tickets)} son público nuevo,
              </strong>
              <br />
              nunca habían ido a una función tuya.
            </span>
            <span className="flex flex-col items-end">
              <span className="text-[13px] text-ink-2">Pagas a TILCA</span>
              <span className="font-condensed text-[26px] font-bold tabular">Bs {formatCount(stats.newAudience * PRICE_PER_NEW_ATTENDEE)}</span>
              <span className="text-xs text-ink-3">
                {stats.newAudience} × Bs {PRICE_PER_NEW_ATTENDEE}
              </span>
              <Link href={`/panel/evento/${event.id}/presupuesto`} className="mt-1 text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1">
                Ver Escrow en Stellar ↗
              </Link>
            </span>
          </div>
        </section>
      </div>

      <section className="panel flex flex-col gap-5 px-5 py-5 sm:px-[22px]" aria-labelledby="h-codigos">
        <div>
          <h2 id="h-codigos" className="m-0 text-base font-semibold">
            Códigos TILCA
          </h2>
          <p className="mt-1 mb-0 text-sm text-ink-2">
            Cada persona que toca “Comprar entrada” recibe un código. Cuando alguien compra con su código, márcalo aquí: así se cuentan
            las entradas que te trajo TILCA.
          </p>
        </div>
        <CodesManager />
        <CodesTable codes={totals.codes.slice(0, 12)} total={totals.codes.length} />
      </section>

      {process.env.NEXT_PUBLIC_ENABLE_SIMULATOR === "true" && event.status === "publicado" && <Simulator eventId={event.id} />}
    </>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function FunnelRow({ label, value, rate, width, first }: { label: string; value: number; rate: number | null; width: number; first: boolean }) {
  return (
    <>
      <span className={first ? "" : "mt-2"}>
        {label} {rate !== null && <span className="font-medium text-ink-3">({rate}%)</span>}
      </span>
      <strong className={`text-right text-base font-semibold ${first ? "" : "mt-2"}`}>{formatCount(value)}</strong>
      <span aria-hidden="true" className="col-span-2 h-2.5 min-w-1 overflow-hidden rounded-full bg-fog">
        <span
          className="block h-full rounded-full bg-chart transition-all duration-500 ease-out"
          style={{ width: `${Math.max(width, value > 0 ? 1.5 : 0)}%` }}
        />
      </span>
    </>
  );
}

function ChannelRow({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <>
      <span className="font-medium text-ink-2">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-fog">
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-chart transition-all duration-500 ease-out"
          style={{ width: `${(count / max) * 100}%`, minWidth: count > 0 ? 4 : 0 }}
        />
      </span>
      <span className="text-right font-semibold text-ink">{count}</span>
    </>
  );
}

function CodesTable({
  codes,
  total,
}: {
  codes: ClickRow[];
  total: number;
}) {
  if (!codes.length) {
    return <p className="m-0 text-sm text-ink-2">Todavía nadie tocó “Comprar entrada” en este evento.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-sm tabular">
        <caption className="pb-2 text-left text-[13px] text-ink-2">
          Últimos {codes.length} de {formatCount(total)} códigos generados
        </caption>
        <thead>
          <tr className="text-left text-[13px] text-ink-2">
            <th scope="col" className="py-2 pr-3 font-medium">Código</th>
            <th scope="col" className="py-2 pr-3 font-medium">Canal</th>
            <th scope="col" className="py-2 pr-3 font-medium">Clic</th>
            <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
            <th scope="col" className="py-2 pr-3 font-medium">Stellar Testnet</th>
            <th scope="col" className="py-2 font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.code} className="border-t border-line">
              <td className="py-2 pr-3 font-semibold">
                {c.code}
                {c.is_sample && <span className="ml-2 text-xs font-normal text-ink-3">ejemplo</span>}
              </td>
              <td className="py-2 pr-3 text-ink-2">{CHANNELS.find((ch) => ch.id === c.channel)?.label ?? "Link directo"}</td>
              <td className="py-2 pr-3 text-ink-2">{formatShort(c.created_at)}</td>
              <td className="py-2 pr-3">
                {c.redeemed_at ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" />
                    Canjeado{c.is_new_audience ? ", público nuevo" : ""}
                  </span>
                ) : (
                  <span className="text-ink-2">Sin canjear</span>
                )}
              </td>
              <td className="py-2 pr-3">
                {c.stellar_tx_hash ? (
                  <a
                    href={explorerTxUrl(c.stellar_tx_hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-underline inline-flex items-center gap-1 font-semibold text-accent text-xs"
                    title="Ver transacción en Stellar Expert"
                  >
                    Comprobante ↗
                  </a>
                ) : c.charge_status === "pendiente" ? (
                  <span className="text-xs font-semibold text-warn">Cobro pendiente</span>
                ) : (
                  <span className="text-xs text-ink-3">—</span>
                )}
              </td>
              <td className="py-2 text-right">
                {c.redeemed_at && (
                  <form action={unredeemCode}>
                    <input type="hidden" name="code" value={c.code} />
                    <button type="submit" className="link-underline text-[13px] font-semibold text-ink-2 hover:text-ink">
                      Deshacer
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
