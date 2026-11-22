import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TestCheckout } from "@/components/ticketing/TestCheckout";
import { formatLong } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { soldElsewhere, TEST_TICKETING_ENABLED } from "@/lib/test-ticketing";

export const metadata: Metadata = { title: "Ticketera de prueba", robots: { index: false } };

/**
 * Ticketera de prueba: hace de "la ticketera del organizador" para probar el flujo
 * completo (comprar con el código TILCA, confirmar ventas, cerrar y cobrar el 5%).
 */
export default async function TestTicketingPage({ params }: PageProps<"/ticketera/[id]">) {
  if (!TEST_TICKETING_ENABLED) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data: event } = await db
    .from("events")
    .select("id, title, starts_at, venue_name, price, status, discount_code, discount_amount, discount_unit, organizers(name)")
    .eq("id", id)
    .maybeSingle();
  if (!event || event.status !== "publicado" || !(Number(event.price) > 0)) notFound();
  const { data: sold } = await db.from("test_ticket_sales").select("seats").eq("event_id", id);
  const taken = [...soldElsewhere(id), ...(sold ?? []).flatMap((s) => s.seats as string[])];
  const organizer = (event.organizers as { name?: string } | null)?.name;

  return (
    <div className="flex min-h-dvh flex-col bg-fog">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <span className="text-lg font-extrabold tracking-tight">
          Boletería<span className="text-chart">.prueba</span>
        </span>
        <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning-text">Simulación: nada es real</span>
      </header>
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 py-6 sm:px-6">
        <div>
          <Link href={`/evento/${id}`} className="link-underline text-sm text-ink-2">
            ← Volver al evento en TILCA
          </Link>
          <h1 className="font-condensed mt-2 mb-0 text-[34px] leading-none font-extrabold">{event.title}</h1>
          <p className="mt-1.5 mb-0 text-[15px] text-ink-2">
            {event.starts_at ? formatLong(event.starts_at) : ""}
            {event.venue_name ? ` · ${event.venue_name}` : ""}
            {organizer ? ` · ${organizer}` : ""}
          </p>
        </div>
        <TestCheckout
          event={{
            id: event.id,
            price: Number(event.price),
            discount_code: event.discount_code,
            discount_amount: event.discount_amount === null ? null : Number(event.discount_amount),
            discount_unit: event.discount_unit,
          }}
          taken={taken}
        />
      </main>
    </div>
  );
}
