import { simulate } from "@/app/panel/simulate";
import { CHANNELS } from "@/lib/constants";

/** Herramienta de prueba: genera actividad marcada como ejemplo para ver cambiar los números. */
export function Simulator({ eventId }: { eventId: string }) {
  const btn = "btn-secondary h-10 px-3.5 text-sm";
  return (
    <section className="panel flex flex-col gap-3 border-dashed p-5 sm:px-[22px]">
      <div>
        <h2 className="m-0 text-base font-semibold">Simular actividad</h2>
        <p className="mt-1 mb-0 text-sm text-ink-2">
          Solo para probar el prototipo. Lo simulado se guarda marcado como ejemplo.
        </p>
      </div>
      <form action={simulate} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="event_id" value={eventId} />
        <label htmlFor="sim-channel" className="sr-only">
          Canal
        </label>
        <select id="sim-channel" name="channel" defaultValue="whatsapp" className="field h-10 w-auto text-sm">
          {CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" name="kind" value="vistas" className={btn}>
          Sumar 10 vistas
        </button>
        <button type="submit" name="kind" value="clics" className={btn}>
          Sumar 3 clics en comprar
        </button>
        <button type="submit" name="kind" value="canjes" className={btn}>
          Canjear 1 código
        </button>
      </form>
    </section>
  );
}
