"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buyTestTickets } from "@/app/ticketera/actions";
import { formatBs } from "@/lib/format";
import { MAX_SEATS, pricing, ROWS, SEATS_PER_ROW } from "@/lib/test-ticketing";

interface Props {
  event: { id: string; price: number | null; discount_code: string | null; discount_amount: number | null; discount_unit: "bs" | "pct" | null };
  taken: string[];
}

/** Plano de butacas y pago de la ticketera de prueba. */
export function TestCheckout({ event, taken: initialTaken }: Props) {
  const router = useRouter();
  const [taken, setTaken] = useState(() => new Set(initialTaken));
  const [selected, setSelected] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [payment, setPayment] = useState<"tarjeta" | "qr">("tarjeta");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const p = pricing(event, selected.length, code);
  const codeTyped = code.trim() !== "";

  function toggle(seat: string) {
    setError(null);
    setSelected((s) => (s.includes(seat) ? s.filter((x) => x !== seat) : s.length >= MAX_SEATS ? s : [...s, seat]));
  }

  function pay() {
    setError(null);
    start(async () => {
      const res = await buyTestTickets({ eventId: event.id, seats: selected, code, name, payment });
      if (res.ok && res.saleId) {
        router.push(`/ticketera/${event.id}/compra/${res.saleId}`);
        return;
      }
      if (res.taken) {
        setTaken((t) => new Set([...t, ...res.taken!]));
        setSelected((s) => s.filter((x) => !res.taken!.includes(x)));
      }
      setError(res.message ?? "No se pudo completar la compra.");
    });
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel flex flex-col gap-4 overflow-x-auto p-5" aria-labelledby="h-butacas">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="h-butacas" className="m-0 text-base font-semibold">
            Elige tus butacas
          </h2>
          <span className="text-sm text-ink-2">Hasta {MAX_SEATS} por compra</span>
        </div>
        <div className="mx-auto flex min-w-[560px] flex-col items-center gap-1.5">
          <div className="mb-3 w-3/4 rounded-b-[40px] bg-ink py-1.5 text-center text-xs font-semibold tracking-[0.3em] text-white">ESCENARIO</div>
          {ROWS.map((row) => (
            <div key={row} className="flex items-center gap-1.5">
              <span className="w-4 text-xs font-semibold text-ink-3">{row}</span>
              {Array.from({ length: SEATS_PER_ROW }, (_, i) => {
                const seat = `${row}${i + 1}`;
                const isTaken = taken.has(seat);
                const isOn = selected.includes(seat);
                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={isTaken}
                    aria-pressed={isOn}
                    aria-label={`Butaca ${seat}${isTaken ? ", vendida" : ""}`}
                    onClick={() => toggle(seat)}
                    className={`h-7 w-7 rounded-t-[8px] rounded-b-[3px] text-[10px] font-semibold transition-colors ${i === 6 ? "mr-4" : ""} ${
                      isTaken ? "cursor-not-allowed bg-line text-transparent" : isOn ? "bg-primary text-white" : "border border-control bg-surface text-ink-2 hover:border-primary"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="mt-3 flex gap-4 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] border border-control bg-surface" /> Libre
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] bg-primary" /> Tu elección
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] bg-line" /> Vendida
            </span>
          </div>
        </div>
      </section>

      <section className="panel flex flex-col gap-4 p-5 lg:sticky lg:top-4" aria-labelledby="h-pago">
        <h2 id="h-pago" className="m-0 text-base font-semibold">
          Tu compra
        </h2>
        <p className="m-0 text-sm text-ink-2">{selected.length ? `Butacas: ${[...selected].sort((a, b) => a.localeCompare(b, "es", { numeric: true })).join(", ")}` : "Todavía no elegiste butacas."}</p>

        <label className="flex flex-col gap-1.5">
          <span className="label">Código de descuento</span>
          <input
            className="field uppercase"
            value={code}
            onChange={(ev) => setCode(ev.target.value)}
            placeholder="Por ejemplo, TILCA10"
            autoCapitalize="characters"
            aria-invalid={codeTyped && !p.codeValid ? true : undefined}
          />
          {codeTyped && (
            <span className={`text-sm ${p.codeValid ? "text-primary" : "text-danger"}`}>
              {p.codeValid ? `Código aplicado: ${formatBs(p.discountPerTicket)} menos por entrada.` : "Ese código no es válido para este evento."}
            </span>
          )}
        </label>

        <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-1.5 text-[15px] tabular">
          <dt className="text-ink-2">
            {selected.length} × {formatBs(p.unitPrice)}
          </dt>
          <dd className="m-0 text-right">{formatBs(p.subtotal)}</dd>
          {p.discount > 0 && (
            <>
              <dt className="text-ink-2">Descuento {event.discount_code}</dt>
              <dd className="m-0 text-right text-primary">− {formatBs(p.discount)}</dd>
            </>
          )}
          <dt className="border-t border-line pt-1.5 font-semibold">Total</dt>
          <dd className="m-0 border-t border-line pt-1.5 text-right font-bold">{formatBs(p.total)}</dd>
        </dl>

        <label className="flex flex-col gap-1.5">
          <span className="label">Nombre</span>
          <input className="field" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="name" />
        </label>
        <fieldset className="m-0 flex gap-2 border-0 p-0">
          <legend className="label mb-1.5">Pago</legend>
          {(["tarjeta", "qr"] as const).map((m) => (
            <label key={m} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-control border px-3 py-2.5 text-sm ${payment === m ? "border-primary bg-primary-soft font-semibold" : "border-line"}`}>
              <input type="radio" name="payment" className="sr-only" checked={payment === m} onChange={() => setPayment(m)} />
              {m === "tarjeta" ? "Tarjeta" : "QR"}
            </label>
          ))}
        </fieldset>

        {error && (
          <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn-ink">
            {error}
          </p>
        )}
        <button type="button" onClick={pay} disabled={pending || !selected.length || !name.trim()} className="btn-primary h-12 text-base">
          {pending ? "Procesando…" : `Pagar ${formatBs(p.total)} (simulado)`}
        </button>
        <span className="text-xs text-ink-3">Simulación: no se cobra nada ni se piden datos de pago.</span>
      </section>
    </div>
  );
}
