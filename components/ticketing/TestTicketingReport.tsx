import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmFromTestReport } from "@/app/ticketera/actions";
import { formatBs, formatShort } from "@/lib/format";

interface Sale {
  id: string;
  seats: string[];
  quantity: number;
  discount_code: string | null;
  total_bs: number;
  buyer_name: string;
  created_at: string;
  confirmed_at: string | null;
}

/**
 * Reporte de la ticketera de prueba en "Confirmar ventas": lo que el organizador vería
 * en el reporte de su ticketera real, filtrado por el código TILCA.
 */
export async function TestTicketingReport({
  supabase,
  eventId,
  code,
  open,
}: {
  supabase: SupabaseClient;
  eventId: string;
  code: string | null;
  open: boolean;
}) {
  const { data } = await supabase
    .from("test_ticket_sales")
    .select("id, seats, quantity, discount_code, total_bs, buyer_name, created_at, confirmed_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  const sales = (data ?? []) as Sale[];
  const withCode = sales.filter((s) => s.discount_code).reduce((n, s) => n + s.quantity, 0);
  const withoutCode = sales.filter((s) => !s.discount_code).reduce((n, s) => n + s.quantity, 0);
  const pending = sales.filter((s) => s.discount_code && !s.confirmed_at).reduce((n, s) => n + s.quantity, 0);

  return (
    <section className="panel flex flex-col gap-4 border-l-4 border-l-chart p-5 sm:p-6" aria-labelledby="h-reporte">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="h-reporte" className="m-0 text-base font-semibold">
            Reporte de la ticketera de prueba
          </h2>
          <p className="mt-1 mb-0 max-w-[70ch] text-sm text-ink-2">
            Simulación: es lo que verías en el reporte de tu ticketera. Con el código {code ?? "TILCA"} se vendieron{" "}
            <strong className="text-ink">{withCode}</strong> entradas ({withCode - pending} ya confirmadas en TILCA); sin código, {withoutCode}.
          </p>
        </div>
        <Link href={`/ticketera/${eventId}`} target="_blank" className="btn-secondary h-10 px-3.5 text-sm">
          Abrir la ticketera ↗
        </Link>
      </div>
      {open && pending > 0 && (
        <form action={confirmFromTestReport} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="event_id" value={eventId} />
          <button type="submit" className="btn-primary h-11 px-5 text-[15px]">
            Confirmar las {pending} ventas nuevas con código
          </button>
          <span className="text-sm text-ink-2">Es lo mismo que escribir {pending} en “Ventas por ticketera”.</span>
        </form>
      )}
      {sales.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm tabular">
            <thead>
              <tr className="text-left text-[13px] text-ink-2">
                <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
                <th scope="col" className="py-2 pr-3 font-medium">Comprador</th>
                <th scope="col" className="py-2 pr-3 font-medium">Butacas</th>
                <th scope="col" className="py-2 pr-3 font-medium">Código</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Pagado</th>
                <th scope="col" className="py-2 font-medium">En TILCA</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 20).map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2 pr-3 text-ink-2">{formatShort(s.created_at)}</td>
                  <td className="py-2 pr-3">{s.buyer_name}</td>
                  <td className="py-2 pr-3">{s.seats.join(", ")}</td>
                  <td className="py-2 pr-3">{s.discount_code ?? <span className="text-ink-3">—</span>}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{formatBs(s.total_bs)}</td>
                  <td className="py-2 text-ink-2">{!s.discount_code ? "No aplica" : s.confirmed_at ? "Confirmada" : "Por confirmar"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 text-sm text-ink-2">Todavía no hay compras en la ticketera de prueba.</p>
      )}
    </section>
  );
}
