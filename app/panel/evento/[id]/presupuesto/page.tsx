import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { retryDeposit } from "@/app/panel/actions";
import { DepositForm } from "@/components/panel/SalesForms";
import { Stat } from "@/components/panel/Stat";
import { COMISION_LABEL } from "@/lib/constants";
import { formatBs, formatCount, formatPrice, formatShort } from "@/lib/format";
import { requireOrganizer } from "@/lib/organizer";
import { loadSalesSummary, TX_LABELS } from "@/lib/sales";
import { explorerAccountUrl, explorerTxUrl, PLATFORM_PUBLIC_KEY } from "@/lib/stellar/config";
import { EVENT_PANEL_COLUMNS, type TilcaEvent } from "@/lib/types";

export const metadata: Metadata = { title: "Presupuesto y cobros" };

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
  sin_escrow: { label: "Sin depósito", tone: "muted" },
  deposito_pendiente: { label: "Depósito pendiente", tone: "warn" },
  depositando: { label: "Depositando…", tone: "muted" },
  activo: { label: "Depósito en garantía", tone: "ok" },
  cerrando: { label: "Cerrando…", tone: "muted" },
  cierre_pendiente: { label: "Pendiente de cobro", tone: "warn" },
  cerrado: { label: "Cerrado", tone: "muted" },
  agotado: { label: "Modelo anterior", tone: "muted" },
  reembolsado: { label: "Modelo anterior", tone: "muted" },
};

export default async function BudgetPage({ params }: PageProps<"/panel/evento/[id]/presupuesto">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, organizer } = await requireOrganizer();
  const { data: event } = await supabase
    .from("events")
    .select(EVENT_PANEL_COLUMNS)
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .maybeSingle<TilcaEvent>();
  if (!event) notFound();

  const status = event.escrow_status ?? "sin_escrow";
  const badge = STATUS[status] ?? STATUS.sin_escrow;
  const isPaid = Number(event.price ?? 0) > 0 && !event.source;
  const s = await loadSalesSummary(supabase, event);
  const orgKey = organizer.stellar_public_key ?? event.organizers?.stellar_public_key ?? null;
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
          <span aria-hidden="true">/</span> Presupuesto y cobros
        </nav>
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-condensed m-0 text-[34px] leading-none font-extrabold tracking-[-0.5px] sm:text-[40px]">Presupuesto y cobros</h1>
            <p className="mt-2 mb-0 max-w-[62ch] text-[15px] text-ink-2">
              Publicar es gratis. TILCA cobra el {COMISION_LABEL} de cada entrada que vendemos con tu código, desde el depósito en
              garantía; lo que no se usa vuelve a tu cuenta al cerrar el evento.
            </p>
          </div>
          {isPaid && (
            <Link href={`/panel/evento/${event.id}/ventas`} className="btn-primary h-[38px] px-3.5 text-sm">
              Confirmar ventas
            </Link>
          )}
        </div>
      </div>

      {!isPaid ? (
        <section className={card}>
          <p className="m-0 text-[15px] text-ink-2">
            {event.source
              ? "Los eventos importados de una ticketera no tienen depósito ni cobro."
              : "Los eventos gratis no tienen depósito ni cobro."}
          </p>
        </section>
      ) : (
        <>
          <section aria-label="Resumen" className="panel grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-4">
            <Stat label="Depositado" value={formatBs(s.deposited)} note={`En el escrow hoy: ${formatBs(s.balance)}`} />
            <Stat label="Ventas confirmadas con código TILCA" value={formatCount(s.total)} note={`a ${formatPrice(event.price)} cada una`} />
            <Stat label={`Comisión (${COMISION_LABEL})`} value={formatBs(status === "cerrado" ? s.paidCommission : s.commission)} note={status === "cerrado" ? "Pagada a TILCA" : "Se paga al cerrar"} />
            <Stat
              label="Devuelto"
              value={formatBs(s.refunded)}
              note={status === "cerrado" ? "Volvió a tu cuenta" : `Al cerrar: ${formatBs(s.refund)}`}
            />
          </section>

          <section className={card} aria-labelledby="h-escrow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="h-escrow" className="m-0 text-base font-semibold">
                Depósito en garantía
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  badge.tone === "ok" ? "bg-primary-soft text-primary" : badge.tone === "warn" ? "bg-warning-bg text-warning-text" : "bg-fog text-ink-2"
                }`}
              >
                {badge.label}
              </span>
            </div>

            {status === "deposito_pendiente" && (
              <div className="flex flex-col gap-3">
                <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3.5 py-3 text-sm text-warn-ink">
                  El depósito de {formatBs(event.promo_budget_bs)} no llegó al escrow{event.escrow_error ? ` (${event.escrow_error})` : ""}.
                  Tu evento sigue publicado.
                </p>
                <form action={retryDeposit}>
                  <input type="hidden" name="event_id" value={event.id} />
                  <button type="submit" className="btn-secondary h-11 px-4 text-[15px]">
                    Reintentar el depósito
                  </button>
                </form>
              </div>
            )}

            {(status === "activo" || status === "sin_escrow") && (
              <div className="flex flex-col gap-2">
                <p className="m-0 text-sm text-ink-2">
                  {s.missing > 0
                    ? `Tu depósito no alcanza para la comisión de lo confirmado: faltan ${formatBs(s.missing)}.`
                    : status === "sin_escrow"
                      ? "Este evento todavía no tiene depósito."
                      : "¿Esperas vender más? Agrega un depósito."}
                </p>
                <DepositForm eventId={event.id} suggested={s.missing || undefined} label={status === "sin_escrow" ? "Depositar" : "Agregar depósito"} />
              </div>
            )}

            {status === "cierre_pendiente" && (
              <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3.5 py-3 text-sm text-warn-ink">
                El cierre quedó pendiente de cobro.{" "}
                <Link href={`/panel/evento/${event.id}/ventas`} className="link-underline font-semibold">
                  Reintentar desde Confirmar ventas
                </Link>
              </p>
            )}

            <dl className="m-0 grid gap-x-4 gap-y-1.5 text-xs text-ink-2 sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold text-ink">Escrow del evento</dt>
              <dd className="m-0 break-all">
                {event.escrow_account ? (
                  <a href={explorerAccountUrl(event.escrow_account)} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
                    {event.escrow_account} ↗
                  </a>
                ) : (
                  "Se crea con el primer depósito."
                )}
              </dd>
              <dt className="font-semibold text-ink">Tu cuenta</dt>
              <dd className="m-0 break-all">
                {orgKey ? (
                  <a href={explorerAccountUrl(orgKey)} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
                    {orgKey} ↗
                  </a>
                ) : (
                  "Se crea con el primer depósito."
                )}
              </dd>
              <dt className="font-semibold text-ink">Cuenta TILCA</dt>
              <dd className="m-0 break-all">
                {PLATFORM_PUBLIC_KEY ? (
                  <a href={explorerAccountUrl(PLATFORM_PUBLIC_KEY)} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
                    {PLATFORM_PUBLIC_KEY} ↗
                  </a>
                ) : (
                  "Sin configurar"
                )}
              </dd>
            </dl>
            <p className="m-0 text-xs text-ink-3">Stellar Testnet. 1 Bs se representa con 1 XLM de prueba.</p>
          </section>

          <section className={card} aria-labelledby="h-comprobantes">
            <h2 id="h-comprobantes" className="m-0 text-base font-semibold">
              Comprobantes
            </h2>
            {!s.txs.length ? (
              <p className="m-0 text-sm text-ink-2">Todavía no hay movimientos en Stellar para este evento.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm tabular">
                  <thead>
                    <tr className="text-left text-[13px] text-ink-2">
                      <th scope="col" className="py-2 pr-4 font-medium">Fecha</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Movimiento</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Monto</th>
                      <th scope="col" className="py-2 text-right font-medium">
                        <span className="sr-only">Comprobante</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.txs.map((t) => (
                      <tr key={t.id} className="border-t border-line">
                        <td className="py-2.5 pr-4 text-ink-2">{formatShort(t.created_at)}</td>
                        <td className="py-2.5 pr-4 font-medium">{TX_LABELS[t.kind]}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{formatBs(t.amount_bs)}</td>
                        <td className="py-2.5 text-right">
                          <a href={explorerTxUrl(t.tx_hash)} target="_blank" rel="noopener noreferrer" className="link-underline text-xs font-semibold text-primary">
                            Ver comprobante ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
