"use client";

import { useState, useTransition } from "react";
import { demoClose, demoConfirm, demoPublish, type DemoBalances, type DemoStep } from "@/app/demo/actions";
import { explorerAccountUrl, explorerTxUrl } from "@/lib/stellar/config";

const STEPS = [
  { title: "Publicar y depositar", hint: "Evento de Bs 80, 30 ventas esperadas: deposita Bs 120 en el escrow." },
  { title: "Confirmar ventas", hint: "10 ventas por ticketera y 2 marcadas en puerta." },
  { title: "Cerrar el evento", hint: "El escrow libera Bs 48 a TILCA y devuelve Bs 72." },
];
const TX_NAMES = [["Depósito"], [], ["Comisión a TILCA", "Devolución al organizador"]];

type StepState = { status: "idle" | "running" | "done" | "error"; result?: DemoStep };

export function DemoInteractive({ initialBalances }: { initialBalances: DemoBalances }) {
  const [balances, setBalances] = useState<DemoBalances>(initialBalances);
  const [steps, setSteps] = useState<StepState[]>(STEPS.map(() => ({ status: "idle" })));
  const [escrow, setEscrow] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshBalances() {
    try {
      const res = await fetch("/api/demo-balances", { cache: "no-store" });
      if (res.ok) setBalances(await res.json());
    } catch {
      // Horizon puede tardar: se reintenta con el botón.
    }
  }

  function run() {
    startTransition(async () => {
      setEscrow(null);
      const next: StepState[] = STEPS.map(() => ({ status: "idle" }));
      const update = (i: number, s: StepState) => {
        next[i] = s;
        setSteps([...next]);
      };

      update(0, { status: "running" });
      const published = await demoPublish();
      update(0, { status: published.ok ? "done" : "error", result: published });
      if (!published.ok) return;
      setEscrow(published.escrowAccount ?? null);

      update(1, { status: "running" });
      const confirmed = await demoConfirm(published.eventId);
      update(1, { status: confirmed.ok ? "done" : "error", result: confirmed });
      if (!confirmed.ok) return;

      update(2, { status: "running" });
      const closed = await demoClose(published.eventId);
      update(2, { status: closed.ok ? "done" : "error", result: closed });
      await refreshBalances();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="panel p-5 sm:p-7" aria-labelledby="h-simulador">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 id="h-simulador" className="m-0 text-xl font-bold text-ink">
              El recorrido completo, en Testnet
            </h2>
            <p className="mt-1 mb-0 text-sm text-ink-2">Tres pasos con transacciones reales. Cada comprobante se abre en Stellar Expert.</p>
          </div>
          <button type="button" disabled={isPending} onClick={run} className="btn-primary h-12 px-6 text-base font-bold">
            {isPending ? "Procesando en Stellar…" : "Simular"}
          </button>
        </div>

        <ol className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {STEPS.map((step, i) => {
            const s = steps[i];
            const r = s.result;
            return (
              <li
                key={step.title}
                className={`flex flex-col gap-2 rounded-[10px] border p-4 ${
                  s.status === "done"
                    ? "border-primary/25 bg-primary-soft"
                    : s.status === "error"
                      ? "border-warn-line bg-warn-bg"
                      : "border-line bg-surface"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-bold ${
                      s.status === "done" ? "bg-primary text-white" : "bg-fog text-ink-2"
                    }`}
                  >
                    {s.status === "done" ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="text-[15px] font-semibold text-ink">{step.title}</strong>
                    <p className="m-0 text-sm text-ink-2">
                      {s.status === "running" ? "En curso…" : r && r.ok ? r.detail : r && !r.ok ? r.error : step.hint}
                    </p>
                  </div>
                </div>
                {r?.ok && r.hashes.length > 0 && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 pl-10">
                    {r.hashes.map((h, k) => (
                      <a key={h} href={explorerTxUrl(h)} target="_blank" rel="noopener noreferrer" className="link-underline text-sm font-semibold text-primary">
                        Ver comprobante: {TX_NAMES[i][k] ?? "Transacción"} ↗
                      </a>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {escrow && (
          <p className="mt-4 mb-0 text-xs break-all text-ink-2">
            Cuenta de escrow del evento:{" "}
            <a href={explorerAccountUrl(escrow)} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
              {escrow} ↗
            </a>
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2" aria-label="Cuentas en Testnet">
        <Account title="Cuenta TILCA" note="Recibe las comisiones" publicKey={balances.platform.publicKey} balances={balances.platform.balances} />
        <Account
          title="Organizador de ejemplo"
          note="Deposita y recibe la devolución"
          publicKey={balances.organizer.publicKey}
          balances={balances.organizer.balances}
        />
      </section>
      <button type="button" onClick={() => void refreshBalances()} className="link-underline self-start text-sm text-ink-2 hover:text-ink">
        ↻ Actualizar saldos
      </button>
    </div>
  );
}

function Account({
  title,
  note,
  publicKey,
  balances,
}: {
  title: string;
  note: string;
  publicKey: string | null;
  balances: DemoBalances["platform"]["balances"];
}) {
  return (
    <div className="panel flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">{title}</span>
        <span className="text-[11px] text-ink-3">{note}</span>
      </div>
      {publicKey ? (
        <a href={explorerAccountUrl(publicKey)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs break-all text-primary hover:underline">
          {publicKey} ↗
        </a>
      ) : (
        <span className="text-xs text-ink-3">Se crea con el primer depósito.</span>
      )}
      <div className="border-t border-line pt-3">
        {balances ? (
          balances.map((b) => (
            <span key={b.asset} className="mr-3 inline-block rounded-[8px] bg-fog px-3 py-2 text-sm">
              <span className="text-ink-2">{b.asset}:</span> <strong className="tabular">{b.balance}</strong>
            </span>
          ))
        ) : (
          <span className="text-xs text-ink-2">Sin cuenta en Testnet todavía, o Horizon no responde.</span>
        )}
      </div>
    </div>
  );
}
