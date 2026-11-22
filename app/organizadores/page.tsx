import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteHeader } from "@/components/SiteHeader";
import { formatBs, formatShort } from "@/lib/format";
import { explorerTxUrl } from "@/lib/stellar/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { enterAsJury } from "./actions";

export const metadata: Metadata = {
  title: "Para organizadores",
  description: "Publica gratis en TILCA y paga 5% solo por las entradas que vendemos.",
};

const STEPS = [
  { title: "Publica gratis", text: "Sube tu evento con tu código de descuento de la ticketera." },
  { title: "La gente lo descubre", text: "Lo encuentran en el mapa y compran en tu ticketera con el código." },
  { title: "Pagas solo lo vendido", text: "Al cerrar, el escrow en Stellar libera el 5% de lo vendido y te devuelve el resto." },
];

/** Un comprobante real de comisión (el más reciente), para mostrar que cada cobro se puede verificar. */
async function latestReceipt() {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("escrow_transactions")
      .select("tx_hash, amount_bs, created_at, kind, events(title)")
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = (data ?? []) as unknown as { tx_hash: string; amount_bs: number; created_at: string; kind: string; events: { title: string } | null }[];
    return rows.find((r) => r.kind === "comision") ?? rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function OrganizersPage() {
  await connection(); // el comprobante se lee en cada visita
  const receipt = await latestReceipt();

  return (
    <div className="flex min-h-dvh flex-col bg-fog">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="bg-primary text-white">
          <div className="mx-auto flex max-w-[1040px] flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-end md:py-16">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold tracking-wide text-accent uppercase">Para organizadores</p>
              <h1 className="font-condensed mt-3 mb-0 text-[44px] leading-[0.95] font-extrabold tracking-[-0.5px] sm:text-[60px]">
                Llega a público nuevo. Paga solo por lo que vendemos.
              </h1>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/registro?rol=organizador" className="btn-primary h-12 bg-accent px-6 text-base text-ink hover:bg-accent/90">
                  Publicar mi evento
                </Link>
                <form action={enterAsJury}>
                  <button type="submit" className="h-12 rounded-control border border-white/50 px-6 text-base font-semibold text-white hover:bg-white/10">
                    Entrar como jurado
                  </button>
                </form>
              </div>
            </div>
            <figure className="m-0 flex-none rounded-panel bg-white/10 p-6 md:w-[320px]">
              <p className="font-condensed m-0 text-[64px] leading-none font-extrabold text-accent">55 de 62</p>
              <figcaption className="mt-2 text-[15px] leading-snug text-white/90">
                personas encuestadas en La Paz se enteraron de un evento cuando ya había pasado.
              </figcaption>
            </figure>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 py-10 sm:px-6">
          <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="panel flex flex-col gap-2 p-5">
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-base font-bold text-ink">
                  {i + 1}
                </span>
                <h2 className="m-0 text-lg font-semibold">{s.title}</h2>
                <p className="m-0 text-[15px] leading-relaxed text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>

          <section className="panel flex flex-col gap-3 border-l-4 border-l-primary p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="h-verificable">
            <div>
              <h2 id="h-verificable" className="m-0 text-lg font-semibold">
                Cada cobro es verificable
              </h2>
              <p className="mt-1 mb-0 max-w-[62ch] text-[15px] text-ink-2">
                {receipt
                  ? `Cada pago queda en Stellar con su comprobante público. Por ejemplo, ${receipt.kind === "comision" ? "la comisión" : "el movimiento"} de ${formatBs(receipt.amount_bs)}${receipt.events?.title ? ` de “${receipt.events.title}”` : ""}, del ${formatShort(receipt.created_at)}.`
                  : "Cada pago queda en Stellar con su comprobante público, que cualquiera puede revisar."}
              </p>
            </div>
            {receipt && (
              <a href={explorerTxUrl(receipt.tx_hash)} target="_blank" rel="noopener noreferrer" className="btn-secondary h-11 flex-none px-4 text-[15px]">
                Ver comprobante en Stellar Expert ↗
              </a>
            )}
          </section>
          <p className="m-0 text-center text-xs text-ink-3">Pagos en Stellar Testnet durante el piloto.</p>
        </div>
      </main>
    </div>
  );
}
