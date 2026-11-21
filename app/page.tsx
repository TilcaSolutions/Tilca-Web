import { SiteHeader } from "@/components/SiteHeader";
import { Explorer } from "@/components/Explorer";
import { createClient } from "@/lib/supabase/server";
import { EVENT_COLUMNS, type PublicEvent } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 24 * 3600 * 1000);

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("status", "publicado")
    .lte("starts_at", horizon.toISOString())
    // Sigue visible si no terminó: exposiciones (ends_at) o funciones de hoy.
    .or(`ends_at.gte.${now.toISOString()},starts_at.gte.${new Date(now.getTime() - 3 * 3600 * 1000).toISOString()}`)
    .order("starts_at", { ascending: true })
    .returns<PublicEvent[]>();

  if (error) {
    console.error("Error al cargar eventos en app/page.tsx:", error);
  }

  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader live />
      {error ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="panel max-w-md p-6 shadow-sm flex flex-col items-center gap-3">
            <span className="text-3xl">📡</span>
            <h2 className="text-lg font-bold text-ink m-0">No pudimos conectar con Supabase</h2>
            <p className="text-sm text-ink-2 m-0 leading-relaxed">
              Para ver los eventos en local, asegúrate de haber levantado Supabase y ejecutado las migraciones:
            </p>
            <div className="w-full rounded-[8px] bg-fog p-3 text-left font-mono text-xs text-ink-2 space-y-1">
              <div>$ npx supabase start</div>
              <div>$ npm run seed</div>
            </div>
            {error.message && (
              <p className="text-[11px] text-ink-3 m-0 break-all font-mono">
                Detalle: {error.message}
              </p>
            )}
          </div>
        </div>
      ) : (
        <Explorer events={data ?? []} />
      )}
    </div>
  );
}
