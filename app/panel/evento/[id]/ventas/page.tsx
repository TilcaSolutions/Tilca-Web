import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addDoorSale, deleteSale, retryDeposit } from "@/app/panel/actions";
import { CloseEventForm, DepositForm, TicketSalesForm } from "@/components/panel/SalesForms";
import { Stat } from "@/components/panel/Stat";
import { COMISION_LABEL } from "@/lib/constants";
import { formatBs, formatCount, formatLong, formatPrice, formatShort } from "@/lib/format";
import { requireOrganizer } from "@/lib/organizer";
import { loadSalesSummary, TX_LABELS } from "@/lib/sales";
import { explorerTxUrl } from "@/lib/stellar/config";
import { EVENT_PANEL_COLUMNS, type TilcaEvent } from "@/lib/types";

export const metadata: Metadata = { title: "Confirmar ventas" };

const OPEN = ["sin_escrow", "deposito_pendiente", "depositando", "activo"];

export default async function ConfirmSalesPage({ params }: PageProps<"/panel/evento/[id]/ventas">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user, organizer } = await requireOrganizer();
  const { data: event } = await supabase
    .from("events")
    .select(EVENT_PANEL_COLUMNS)
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .maybeSingle<TilcaEvent>();
  if (!event) notFound();

  const status = event.escrow_status ?? "sin_escrow";
  const isPaid = Number(event.price ?? 0) > 0 && !event.source;
  const open = OPEN.includes(status);
  const s = await loadSalesSummary(supabase, event);
  const card = "panel flex flex-col gap-4 p-5 sm:p-6";

  return (
    <>
      <div>
        <nav aria-label="Ruta" className="text-sm text-ink-2">
          <Link href="/panel" className="link-underline">
            Mis eventos
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
          <Link href={`/panel/evento/${event.id}`} className="link-underline">
            {event.title}
          </Link>{" "}
          <span aria-hidden="true">/</span> Confirmar ventas
        </nav>
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-condensed m-0 text-[34px] leading-none font-extrabold tracking-[-0.5px] sm:text-[40px]">Confirmar ventas</h1>
            <p className="mt-2 mb-0 max-w-[62ch] text-[15px] text-ink-2">
              {isPaid ? (
                <>
                  Cuenta las entradas que se vendieron con el código <strong className="font-semibold text-ink">{event.discount_code ?? "TILCA"}</strong>.
                  Puedes confirmar varias veces; al cerrar el evento, TILCA cobra el {COMISION_LABEL} de lo confirmado.
                </>
              ) : (
                "Este evento no tiene código TILCA."
              )}
            </p>
          </div>
          <Link href={`/panel/evento/${event.id}/presupuesto`} className="btn-secondary h-[38px] px-3.5 text-sm">
            Presupuesto y cobros
          </Link>
        </div>
      </div>

      {!isPaid ? (
        <section className={card}>
          <p className="m-0 text-[15px] text-ink-2">
            {event.source
              ? "Los eventos importados de una ticketera no tienen código ni cobro: solo se publican en el mapa."
              : "Los eventos gratis no tienen código, depósito ni cobro. Publicarlos es gratis para siempre."}
          </p>
        </section>
      ) : (
        <>
          <section aria-label="Resumen" className="panel grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-4">
            <Stat label="Ventas confirmadas con código TILCA" value={formatCount(s.total)} note={`${s.ticketera} por ticketera, ${s.puerta} por QR o en puerta`} />
            <Stat
              label={`Comisión TILCA (${COMISION_LABEL})`}
              value={formatBs(s.commission)}
              note={`${s.total} × ${formatPrice(event.price)} × ${COMISION_LABEL}`}
            />
            <Stat label="En el escrow" value={formatBs(s.balance)} note={`Depositado: ${formatBs(s.deposited)}`} />
            <Stat
              label={status === "cerrado" ? "Te devolvimos" : "Te vuelve al cerrar"}
              value={formatBs(status === "cerrado" ? s.refunded : s.refund)}
              note={s.missing > 0 ? `Faltan ${formatBs(s.missing)} de depósito` : "El resto del depósito"}
            />
          </section>

          {open && (
            <div className="flex flex-col gap-4 lg:flex-row">
              <section className={`${card} lg:flex-[3]`} aria-labelledby="h-ticketera">
                <div>
                  <h2 id="h-ticketera" className="m-0 text-base font-semibold">
                    Ventas por ticketera
                  </h2>
                  <p className="mt-1 mb-0 text-sm text-ink-2">
                    Mira en el reporte de tu ticketera cuántas entradas se vendieron con el código y escríbelo aquí. Si ya confirmaste
                    una parte, escribe solo las nuevas: se van sumando.
                  </p>
                </div>
                <TicketSalesForm eventId={event.id} userId={user.id} />
              </section>

              <section className={`${card} lg:flex-[2]`} aria-labelledby="h-puerta">
                <div>
                  <h2 id="h-puerta" className="m-0 text-base font-semibold">
                    Ventas por QR o en puerta
                  </h2>
                  <p className="mt-1 mb-0 text-sm text-ink-2">Cuando alguien te muestra el código al pagar, márcalo.</p>
                </div>
                <div className="flex items-center gap-4">
                  <form action={addDoorSale}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <button type="submit" className="btn-primary h-14 px-6 text-lg">
                      +1 vino por TILCA
                    </button>
                  </form>
                  <span className="flex flex-col">
                    <span className="font-condensed text-[34px] leading-none font-bold tabular">{formatCount(s.puerta)}</span>
                    <span className="text-sm text-ink-2">marcadas</span>
                  </span>
                </div>
              </section>
            </div>
          )}

          <section className={card} aria-labelledby="h-cierre">
            <div>
              <h2 id="h-cierre" className="m-0 text-base font-semibold">
                {status === "cerrado" ? "Evento cerrado" : "Cerrar el evento"}
              </h2>
              <p className="mt-1 mb-0 max-w-[70ch] text-sm text-ink-2">
                {status === "cerrado"
                  ? `Cerrado el ${formatLong(event.closed_at ?? new Date().toISOString())}. Ya no se pueden confirmar más ventas.`
                  : `Al cerrar se calcula ${s.total} ${s.total === 1 ? "entrada" : "entradas"} × ${formatPrice(event.price)} × ${COMISION_LABEL} = ${formatBs(s.commission)}. El escrow libera ese monto a TILCA y te devuelve el resto. Después ya no se pueden confirmar ventas.`}
              </p>
            </div>
            <CloseBlock eventId={event.id} status={status} error={event.escrow_error ?? null} s={s} />
          </section>

          {s.txs.length > 0 && (
            <section className={card} aria-labelledby="h-comprobantes">
              <h2 id="h-comprobantes" className="m-0 text-base font-semibold">
                Comprobantes
              </h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {s.txs.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
                    <span>
                      <strong className="font-semibold">{TX_LABELS[t.kind]}</strong>{" "}
                      <span className="text-ink-2">
                        {formatBs(t.amount_bs)} · {formatShort(t.created_at)}
                      </span>
                    </span>
                    <a href={explorerTxUrl(t.tx_hash)} target="_blank" rel="noopener noreferrer" className="link-underline text-sm font-semibold text-primary">
                      Ver comprobante ↗
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={card} aria-labelledby="h-historial">
            <h2 id="h-historial" className="m-0 text-base font-semibold">
              Confirmaciones
            </h2>
            {!s.sales.length ? (
              <p className="m-0 text-sm text-ink-2">Todavía no confirmaste ventas.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {s.sales.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
                    <span>
                      <strong className="font-semibold tabular">+{r.quantity}</strong>{" "}
                      <span className="text-ink-2">
                        {r.source === "ticketera" ? "por ticketera" : "por QR o en puerta"} · {formatShort(r.created_at)}
                        {r.evidence_path ? " · con respaldo" : ""}
                        {r.is_sample ? " · ejemplo" : ""}
                      </span>
                    </span>
                    {open && (
                      <form action={deleteSale}>
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="sale_id" value={r.id} />
                        <button type="submit" className="link-underline text-[13px] font-semibold text-ink-2 hover:text-ink">
                          Deshacer
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function CloseBlock({
  eventId,
  status,
  error,
  s,
}: {
  eventId: string;
  status: string;
  error: string | null;
  s: Awaited<ReturnType<typeof loadSalesSummary>>;
}) {
  if (status === "cerrado") {
    return (
      <p className="m-0 rounded-control bg-primary-soft px-3.5 py-3 text-[15px] text-primary">
        Se liberaron <strong>{formatBs(s.paidCommission)}</strong> a TILCA y volvieron <strong>{formatBs(s.refunded)}</strong> a tu cuenta.
      </p>
    );
  }
  if (status === "cerrando" || status === "depositando") {
    return <p className="m-0 text-sm text-ink-2">Hay una operación en curso en Stellar. Recarga la página en unos segundos.</p>;
  }
  if (status === "deposito_pendiente") {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3.5 py-3 text-sm text-warn-ink">
          Tu depósito todavía no llegó al escrow{error ? ` (${error})` : ""}. Tu evento sigue publicado; reintenta cuando quieras.
        </p>
        <form action={retryDeposit}>
          <input type="hidden" name="event_id" value={eventId} />
          <button type="submit" className="btn-secondary h-11 px-4 text-[15px]">
            Reintentar el depósito
          </button>
        </form>
      </div>
    );
  }
  if (status === "cierre_pendiente") {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3.5 py-3 text-sm text-warn-ink">
          <strong className="font-semibold">Pendiente de cobro.</strong> Stellar no respondió al cerrar{error ? ` (${error})` : ""}. Tus
          ventas ya quedaron fijas; reintenta el cobro cuando quieras.
        </p>
        <CloseEventForm eventId={eventId} commission={Math.max(0, s.commission - s.paidCommission)} refund={s.refund} retry />
      </div>
    );
  }
  if (s.missing > 0) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3.5 py-3 text-sm text-warn-ink">
          <strong className="font-semibold">Tu depósito no alcanza.</strong> La comisión es {formatBs(s.commission)} y en el escrow hay{" "}
          {formatBs(s.balance)}. Deposita {formatBs(s.missing)} más para poder cerrar.
        </p>
        <DepositForm eventId={eventId} suggested={s.missing} label="Depositar lo que falta" />
      </div>
    );
  }
  return <CloseEventForm eventId={eventId} commission={s.commission} refund={s.refund} />;
}
