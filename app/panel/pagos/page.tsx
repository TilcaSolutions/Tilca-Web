import type { Metadata } from "next";
import Link from "next/link";
import { COMISION_LABEL, commissionFor } from "@/lib/constants";
import { formatBs, formatCount, formatShort } from "@/lib/format";
import { requireOrganizer } from "@/lib/organizer";
import { loadTotals } from "@/lib/stats";

export const metadata: Metadata = { title: "Pagos" };

const STATUS: Record<string, string> = {
  sin_escrow: "Sin depósito",
  deposito_pendiente: "Depósito pendiente",
  depositando: "Depositando",
  activo: "En garantía",
  cerrando: "Cerrando",
  cierre_pendiente: "Pendiente de cobro",
  cerrado: "Cerrado",
};

export default async function PagosPage() {
  const { supabase, organizer } = await requireOrganizer();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, price, source, promo_budget_bs, escrow_balance_bs, escrow_status, commission_bs, refund_bs")
    .eq("organizer_id", organizer.id)
    .eq("status", "publicado")
    .gt("price", 0)
    .is("source", null)
    .order("starts_at", { ascending: false });
  const totals = await loadTotals(supabase, (events ?? []).map((e) => e.id));
  const rows = (events ?? []).map((e) => {
    const sales = totals.get(e.id)?.tickets ?? 0;
    const closed = e.escrow_status === "cerrado";
    return {
      ...e,
      sales,
      commission: closed ? Number(e.commission_bs ?? 0) : commissionFor(sales, Number(e.price)),
      closed,
    };
  });
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Pagos</h1>
          <p className="mt-2 mb-0 max-w-[60ch] text-[15px] text-ink-2">
            Publicar es gratis. TILCA cobra el {COMISION_LABEL} de cada entrada que vendemos con tu código, desde el depósito en
            garantía de cada evento; lo que no se usa vuelve a tu cuenta al cerrarlo.
          </p>
        </div>
        <Link href="/demo" className="btn-secondary h-9 px-3.5 text-sm font-semibold">
          Ver la demo en Stellar
        </Link>
      </div>

      <section className="panel flex flex-wrap items-baseline justify-between gap-4 px-[22px] py-[18px]">
        <div>
          <div className="text-sm text-ink-2">Comisión TILCA</div>
          <div className="font-condensed mt-1.5 text-[34px] leading-none font-bold tabular">{formatBs(totalCommission)}</div>
        </div>
        <span className="text-sm text-ink-2">
          {formatCount(totalSales)} {totalSales === 1 ? "venta confirmada" : "ventas confirmadas"} con código TILCA × {COMISION_LABEL} del precio
        </span>
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[15px] tabular">
          <thead>
            <tr className="text-left text-[13px] text-ink-2">
              <th scope="col" className="px-5 py-3 font-medium">Evento</th>
              <th scope="col" className="p-3 text-right font-medium">Ventas con código</th>
              <th scope="col" className="p-3 text-right font-medium">Depositado</th>
              <th scope="col" className="p-3 text-right font-medium">Comisión</th>
              <th scope="col" className="p-3 text-right font-medium">Devuelto</th>
              <th scope="col" className="p-3 font-medium">Estado</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                <span className="sr-only">Detalle</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <strong className="font-semibold text-ink">{r.title}</strong>
                  <br />
                  <span className="text-sm text-ink-2">{r.starts_at ? formatShort(r.starts_at) : ""}</span>
                </td>
                <td className="p-3 text-right">{formatCount(r.sales)}</td>
                <td className="p-3 text-right">{formatBs(r.promo_budget_bs)}</td>
                <td className="p-3 text-right font-semibold">{formatBs(r.commission)}</td>
                <td className="p-3 text-right">{r.closed ? formatBs(r.refund_bs) : "—"}</td>
                <td className="p-3 text-sm text-ink-2">{STATUS[r.escrow_status ?? "sin_escrow"] ?? "—"}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/panel/evento/${r.id}/presupuesto`} className="link-underline text-sm font-semibold text-primary">
                    Ver cobros
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-ink-2">
                  Todavía no tienes eventos de pago publicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
