import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COMISION_LABEL } from "@/lib/constants";
import { formatBs, formatLong } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { pricing, TEST_TICKETING_ENABLED } from "@/lib/test-ticketing";

export const metadata: Metadata = { title: "Compra confirmada", robots: { index: false } };

export default async function TestReceiptPage({ params }: PageProps<"/ticketera/[id]/compra/[saleId]">) {
  if (!TEST_TICKETING_ENABLED) notFound();
  const { id, saleId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(saleId)) notFound();
  const db = createAdminClient();
  const [{ data: sale }, { data: event }] = await Promise.all([
    db.from("test_ticket_sales").select("*").eq("id", saleId).eq("event_id", id).maybeSingle(),
    db.from("events").select("id, title, starts_at, venue_name, price, discount_code, discount_amount, discount_unit").eq("id", id).maybeSingle(),
  ]);
  if (!sale || !event) notFound();
  const withCode = !!sale.discount_code;
  const p = pricing(event, sale.quantity, sale.discount_code ?? "");

  return (
    <div className="flex min-h-dvh flex-col bg-fog">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <span className="text-lg font-extrabold tracking-tight">
          Boletería<span className="text-chart">.prueba</span>
        </span>
        <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning-text">Simulación: nada es real</span>
      </header>
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 py-8">
        <section className="panel flex flex-col gap-3 p-6">
          <p className="m-0 text-sm font-semibold text-primary">✓ Compra confirmada</p>
          <h1 className="font-condensed m-0 text-[32px] leading-none font-extrabold">{event.title}</h1>
          <p className="m-0 text-[15px] text-ink-2">
            {event.starts_at ? formatLong(event.starts_at) : ""}
            {event.venue_name ? ` · ${event.venue_name}` : ""}
          </p>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
            <dt className="text-ink-2">A nombre de</dt>
            <dd className="m-0 font-semibold">{sale.buyer_name}</dd>
            <dt className="text-ink-2">Butacas</dt>
            <dd className="m-0 font-semibold">{(sale.seats as string[]).join(", ")}</dd>
            <dt className="text-ink-2">Código</dt>
            <dd className="m-0 font-semibold">{sale.discount_code ?? "Sin código"}</dd>
            <dt className="text-ink-2">Pagaste</dt>
            <dd className="m-0 font-semibold">
              {formatBs(sale.total_bs)}
              {Number(sale.discount_bs) > 0 ? ` (ahorraste ${formatBs(sale.discount_bs)})` : ""}
            </dd>
          </dl>
        </section>

        <section className="panel flex flex-col gap-3 border-l-4 border-l-primary p-6" aria-labelledby="h-tilca">
          <h2 id="h-tilca" className="m-0 text-base font-semibold">
            Para la prueba: cómo gana TILCA con esta compra
          </h2>
          {withCode ? (
            <>
              <p className="m-0 text-[15px] text-ink-2">
                Estas {sale.quantity} {sale.quantity === 1 ? "entrada se vendió" : "entradas se vendieron"} con el código{" "}
                <strong className="text-ink">{sale.discount_code}</strong>. Cuando el organizador las confirme y cierre el evento, el escrow le
                paga a TILCA el {COMISION_LABEL} del precio de cada entrada:
              </p>
              <p className="m-0 rounded-control bg-primary-soft px-4 py-3 text-[17px] text-primary">
                {sale.quantity} × {formatBs(p.unitPrice)} × {COMISION_LABEL} = <strong>{formatBs(p.tilcaCommission)}</strong> para TILCA
              </p>
              <p className="m-0 text-sm text-ink-3">
                El descuento ({formatBs(sale.discount_bs)}) lo pone el organizador; la comisión se calcula sobre el precio normal.
              </p>
            </>
          ) : (
            <p className="m-0 text-[15px] text-ink-2">Esta compra no usó el código TILCA: no cuenta como venta de TILCA y no genera comisión.</p>
          )}
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-2">
            <li>Entra al panel como organizador (demo@tilca.bo).</li>
            <li>En el evento, abre “Confirmar ventas”: verás el reporte de esta ticketera y podrás confirmar las ventas nuevas.</li>
            <li>Cierra el evento: el escrow paga la comisión a TILCA y devuelve el resto, con comprobantes en Stellar.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Link href={`/panel/evento/${id}/ventas`} className="btn-primary h-11 px-4 text-[15px]">
              Ir a Confirmar ventas
            </Link>
            <Link href={`/ticketera/${id}`} className="btn-secondary h-11 px-4 text-[15px]">
              Comprar más
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
