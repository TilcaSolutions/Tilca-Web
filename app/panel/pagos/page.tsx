import type { Metadata } from "next";
import Link from "next/link";
import { PRICE_PER_NEW_ATTENDEE } from "@/lib/constants";
import { formatCount, formatShort } from "@/lib/format";
import { requireOrganizer } from "@/lib/organizer";
import { loadTotals } from "@/lib/stats";

export const metadata: Metadata = { title: "Pagos y Escrow en Stellar" };

export default async function PagosPage() {
  const { supabase, organizer } = await requireOrganizer();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, promo_budget_bs, escrow_balance_bs, escrow_status")
    .eq("organizer_id", organizer.id)
    .eq("status", "publicado")
    .order("starts_at", { ascending: false });
  const totals = await loadTotals(supabase, (events ?? []).map((e) => e.id));
  const rows = (events ?? []).map((e) => ({
    ...e,
    ...(totals.get(e.id) ?? { views: 0, clicks: 0, tickets: 0, newAudience: 0 }),
  }));
  const totalNew = rows.reduce((s, r) => s + (r.newAudience ?? 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Pagos y Escrow</h1>
          <p className="mt-2 mb-0 max-w-[60ch] text-[15px] text-ink-2">
            Pagas Bs {PRICE_PER_NEW_ATTENDEE} por cada entrada de público nuevo que te trae TILCA. Las comisiones se liquidan
            automáticamente en Stellar Testnet utilizando un smart escrow de Trustless Work.
          </p>
        </div>
        <Link
          href="/demo"
          className="btn-secondary h-9 px-3.5 text-sm font-semibold inline-flex items-center gap-1.5 border-accent/40 text-accent hover:border-accent"
        >
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Ver Demo para Jurado ⚡
        </Link>
      </div>

      <section className="panel flex flex-wrap items-baseline justify-between gap-4 px-[22px] py-[18px]">
        <div>
          <div className="text-sm text-ink-2">Total a pagar a TILCA</div>
          <div className="font-condensed mt-1.5 text-[34px] leading-none font-bold tabular">Bs {formatCount(totalNew * PRICE_PER_NEW_ATTENDEE)}</div>
        </div>
        <span className="text-sm text-ink-2">
          {totalNew} {totalNew === 1 ? "entrada" : "entradas"} de público nuevo × Bs {PRICE_PER_NEW_ATTENDEE}
        </span>
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[15px] tabular">
          <thead>
            <tr className="text-left text-[13px] text-ink-2">
              <th scope="col" className="px-5 py-3 font-medium">Evento</th>
              <th scope="col" className="p-3 text-right font-medium">Entradas TILCA</th>
              <th scope="col" className="p-3 text-right font-medium">Público nuevo</th>
              <th scope="col" className="p-3 font-medium">Escrow Stellar</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">A pagar</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-fog/30 transition-colors">
                <td className="px-5 py-3">
                  <strong className="font-semibold text-ink">{r.title}</strong>
                  <br />
                  <span className="text-sm text-ink-2">{r.starts_at ? formatShort(r.starts_at) : ""}</span>
                </td>
                <td className="p-3 text-right">{r.tickets}</td>
                <td className="p-3 text-right">{r.newAudience}</td>
                <td className="p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-ink">
                      Bs {Number(r.escrow_balance_bs ?? r.promo_budget_bs ?? 0).toFixed(0)} disp.
                    </span>
                    <span className="text-[11px] text-ink-3">
                      de Bs {Number(r.promo_budget_bs ?? 0).toFixed(0)}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-semibold">Bs {formatCount(r.newAudience * PRICE_PER_NEW_ATTENDEE)}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/panel/evento/${r.id}/presupuesto`}
                    className="link-underline text-xs font-semibold text-accent hover:text-accent-hover"
                  >
                    Ver cobros ↗
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-ink-2">
                  Todavía no tienes eventos publicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
