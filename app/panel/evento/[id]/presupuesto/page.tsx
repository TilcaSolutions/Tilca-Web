import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { retryStellarCharge } from "@/app/panel/actions";
import { BudgetManager } from "@/components/panel/BudgetManager";
import { BS_PER_ATTENDEE, explorerAccountUrl, explorerTxUrl, PLATFORM_PUBLIC_KEY } from "@/lib/stellar/config";
import { formatCount, formatLong, formatShort } from "@/lib/format";
import { requireOrganizer } from "@/lib/organizer";
import { EVENT_COLUMNS, EVENT_PANEL_COLUMNS, type TilcaEvent } from "@/lib/types";

export const metadata: Metadata = { title: "Presupuesto y cobros en Stellar" };

interface ClickChargeRow {
  id: number | string;
  code: string;
  redeemed_at: string | null;
  created_at: string;
  is_new_audience: boolean | null;
  charge_status: string | null;
  stellar_tx_hash: string | null;
  charge_error: string | null;
}

export default async function PresupuestoPage({ params }: PageProps<"/panel/evento/[id]/presupuesto">) {
  const { id } = await params;
  const { supabase, organizer } = await requireOrganizer();

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let event: TilcaEvent | null = null;
  const { data: eventData, error: eventErr } = await supabase
    .from("events")
    .select(EVENT_PANEL_COLUMNS)
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .maybeSingle<TilcaEvent>();

  if (eventErr || !eventData) {
    const { data: fallbackData } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("id", id)
      .eq("organizer_id", organizer.id)
      .maybeSingle<TilcaEvent>();
    event = fallbackData;
  } else {
    event = eventData;
  }

  if (!event) notFound();

  // Cargar todos los canjes y cobros asociados al evento
  const { data: clicksData } = await supabase
    .from("clicks")
    .select("id, code, redeemed_at, created_at, is_new_audience, charge_status, stellar_tx_hash, charge_error")
    .eq("event_id", id)
    .not("redeemed_at", "is", null)
    .order("redeemed_at", { ascending: false });

  const charges = (clicksData ?? []) as ClickChargeRow[];

  const promoBudget = Number(event.promo_budget_bs ?? 0);
  const availableBalance = Number(event.escrow_balance_bs ?? promoBudget);
  const usedAmount = Math.max(0, promoBudget - availableBalance);
  const usedPercent = promoBudget > 0 ? Math.min(100, Math.round((usedAmount / promoBudget) * 100)) : 0;
  const remainingAttendees = Math.floor(availableBalance / BS_PER_ATTENDEE);
  const maxAttendees = Math.floor(promoBudget / BS_PER_ATTENDEE);

  const orgPublicKey = organizer.stellar_public_key || event.organizers?.stellar_public_key;

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
            <h1 className="font-condensed m-0 text-[34px] leading-none font-extrabold tracking-[-0.5px] sm:text-[40px]">
              Presupuesto y cobros
            </h1>
            <p className="mt-2 mb-0 text-[15px] text-ink-2">
              Gestión de depósitos y cobros por canje en Stellar Testnet con Trustless Work Escrow.
            </p>
          </div>
          <BudgetManager
            eventId={event.id}
            currentBalance={availableBalance}
            escrowStatus={event.escrow_status ?? "sin_escrow"}
          />
        </div>
      </div>

      {/* Tarjeta de Resumen Escrow */}
      <section className="panel flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="h-escrow-summary">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <h2 id="h-escrow-summary" className="m-0 text-lg font-bold text-ink">
              Estado del Escrow en Testnet
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                event.escrow_status === "activo"
                  ? "bg-[#EAF6EF] text-[#14532D]"
                  : event.escrow_status === "agotado"
                    ? "bg-[#FEF6EE] text-[#B43403]"
                    : "bg-fog text-ink-2"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  event.escrow_status === "activo" ? "bg-ok animate-pulse" : "bg-ink-3"
                }`}
              />
              {event.escrow_status === "activo"
                ? "Escrow Activo"
                : event.escrow_status === "agotado"
                  ? "Presupuesto Agotado"
                  : event.escrow_status === "reembolsado"
                    ? "Cerrado y Reembolsado"
                    : "Sin Escrow"}
            </span>
          </div>

          {event.stellar_escrow_id && (
            <span className="font-mono text-xs text-ink-2 bg-fog px-2.5 py-1 rounded-[6px]">
              ID: {event.stellar_escrow_id}
            </span>
          )}
        </div>

        {/* Cifras clave: Depositado, Usado, Disponible */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[10px] bg-fog p-4">
            <span className="text-[13px] font-medium text-ink-2">Total depositado</span>
            <div className="font-condensed mt-1 text-[32px] font-bold text-ink tabular">
              Bs {formatCount(promoBudget)}
            </div>
            <span className="text-xs text-ink-3">Hasta {maxAttendees} asistentes nuevos</span>
          </div>

          <div className="rounded-[10px] bg-fog p-4">
            <span className="text-[13px] font-medium text-ink-2">Usado en canjes</span>
            <div className="font-condensed mt-1 text-[32px] font-bold text-accent tabular">
              Bs {formatCount(usedAmount)}
            </div>
            <span className="text-xs text-ink-3">
              {charges.filter((c) => c.is_new_audience && c.charge_status === "cobrado").length} canjes liquidados
            </span>
          </div>

          <div className="rounded-[10px] bg-fog p-4 border border-accent/20">
            <span className="text-[13px] font-medium text-ink-2">Disponible en Escrow</span>
            <div className="font-condensed mt-1 text-[32px] font-bold text-ok tabular">
              Bs {formatCount(availableBalance)}
            </div>
            <span className="text-xs text-ink-2 font-medium">Alcanza para {remainingAttendees} asistentes más</span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex justify-between text-xs text-ink-2">
            <span>Progreso del presupuesto consumido</span>
            <span className="font-semibold text-ink">{usedPercent}% utilizado</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-fog">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${usedPercent}%` }}
              role="progressbar"
              aria-valuenow={usedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Datos técnicos de la red para el jurado */}
        <div className="mt-2 rounded-[8px] border border-line bg-surface p-3.5 text-xs text-ink-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <strong className="text-ink">Cuenta del organizador (Testnet):</strong>{" "}
            {orgPublicKey ? (
              <a
                href={explorerAccountUrl(orgPublicKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-accent hover:underline break-all"
              >
                {orgPublicKey} ↗
              </a>
            ) : (
              <span className="text-ink-3">Generándose automáticamente</span>
            )}
          </div>
          <div>
            <strong className="text-ink">Cuenta TILCA:</strong>{" "}
            <a
              href={explorerAccountUrl(PLATFORM_PUBLIC_KEY)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-accent hover:underline"
            >
              {PLATFORM_PUBLIC_KEY.slice(0, 6)}...{PLATFORM_PUBLIC_KEY.slice(-6)} ↗
            </a>
          </div>
        </div>
      </section>

      {/* Lista de cobros por código canjeado */}
      <section className="panel flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="h-cobros">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 id="h-cobros" className="m-0 text-base font-semibold text-ink">
              Historial de cobros por canje
            </h2>
            <p className="mt-1 mb-0 text-sm text-ink-2">
              Cada canje de público nuevo libera Bs 5 del Escrow hacia la cuenta de TILCA.
            </p>
          </div>
          <span className="text-xs text-ink-2">
            {charges.length} {charges.length === 1 ? "canje registrado" : "canjes registrados"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-sm tabular">
            <thead>
              <tr className="border-b border-line text-left text-[13px] text-ink-2">
                <th scope="col" className="py-2.5 pr-4 font-medium">Fecha y hora</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Código</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Audiencia</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Monto</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Estado</th>
                <th scope="col" className="py-2.5 text-right font-medium">Comprobante Stellar</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => {
                const isNew = c.is_new_audience !== false;
                const isCharged = c.charge_status === "cobrado";
                const isPending = c.charge_status === "pendiente";

                return (
                  <tr key={c.id} className="border-t border-line hover:bg-fog/40 transition-colors">
                    <td className="py-3 pr-4 text-ink-2">
                      {c.redeemed_at ? formatLong(c.redeemed_at) : formatShort(c.created_at)}
                    </td>
                    <td className="py-3 pr-4 font-mono font-semibold text-ink">
                      {c.code}
                    </td>
                    <td className="py-3 pr-4">
                      {isNew ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                          ★ Público nuevo
                        </span>
                      ) : (
                        <span className="text-xs text-ink-3">Ya te conocía (sin cobro)</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-ink">
                      {isNew ? `Bs ${BS_PER_ATTENDEE}.00` : "Bs 0.00"}
                    </td>
                    <td className="py-3 pr-4">
                      {isCharged && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF6EF] px-2.5 py-0.5 text-xs font-semibold text-[#14532D]">
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ok" />
                          Cobrado en Stellar
                        </span>
                      )}
                      {isPending && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF6EE] px-2.5 py-0.5 text-xs font-semibold text-[#B43403]">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warn animate-pulse" />
                            Cobro pendiente
                          </span>
                          <form action={retryStellarCharge}>
                            <input type="hidden" name="click_id" value={c.id} />
                            <button
                              type="submit"
                              className="text-xs font-semibold text-accent hover:underline cursor-pointer"
                            >
                              Reintentar
                            </button>
                          </form>
                        </div>
                      )}
                      {!isCharged && !isPending && !isNew && (
                        <span className="text-xs text-ink-3">No aplica</span>
                      )}
                      {!isCharged && !isPending && isNew && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-fog px-2.5 py-0.5 text-xs font-semibold text-ink-2">
                            Pendiente
                          </span>
                          <form action={retryStellarCharge}>
                            <input type="hidden" name="click_id" value={c.id} />
                            <button
                              type="submit"
                              className="text-xs font-semibold text-accent hover:underline cursor-pointer"
                            >
                              Cobrar
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {c.stellar_tx_hash ? (
                        <a
                          href={explorerTxUrl(c.stellar_tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-underline inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
                          title="Ver transacción en Stellar Expert"
                        >
                          Ver comprobante
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-xs text-ink-3">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!charges.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-ink-2">
                    Todavía no hay canjes registrados para este evento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
