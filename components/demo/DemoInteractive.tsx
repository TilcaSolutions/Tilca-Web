"use client";

import { useState, useTransition } from "react";
import { simulateFullRedemption, type DemoBalances, type SimulationResult } from "@/app/demo/actions";
import { explorerAccountUrl, explorerTxUrl } from "@/lib/stellar/config";

interface RecentTx {
  id: string;
  code: string;
  time: string;
  amountBs: number;
  status: "cobrado" | "pendiente" | "fallido";
  txHash?: string;
}

export function DemoInteractive({ initialBalances }: { initialBalances: DemoBalances }) {
  const [balances, setBalances] = useState<DemoBalances>(initialBalances);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null);
  const [offlineTest, setOfflineTest] = useState(false);
  // Empieza vacío: solo se muestran transacciones reales de esta sesión.
  const [transactions, setTransactions] = useState<RecentTx[]>([]);


  const handleSimulate = (offline = false) => {
    startTransition(async () => {
      setLastResult(null);
      const res = await simulateFullRedemption({ offlineMode: offline });
      setLastResult(res);

      if (res.success) {
        setTransactions((prev) => [
          {
            id: `tx-${Date.now()}`,
            code: res.code,
            time: "Justo ahora",
            amountBs: 5,
            status: res.status,
            txHash: res.txHash,
          },
          ...prev,
        ]);
      }
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/demo-balances");
      if (res.ok) {
        const data = await res.json();
        setBalances(data);
      }
    } catch {
      // Ignorar error de refresco
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Cuentas de Testnet con saldos en vivo */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2" aria-labelledby="h-cuentas">
        {/* Cuenta Plataforma TILCA */}
        <div className="panel flex flex-col justify-between p-5 sm:p-6 border border-line shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                Cuenta Plataforma TILCA
              </span>
              <span className="text-[11px] text-ink-3">Recaudadora de comisiones</span>
            </div>
            <div className="mt-3">
              <span className="text-xs text-ink-2 font-medium">Clave Pública (Testnet):</span>
              <div className="mt-1 flex items-center gap-1.5">
                <a
                  href={explorerAccountUrl(balances.platform.publicKey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-accent hover:underline break-all"
                >
                  {balances.platform.publicKey} ↗
                </a>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <span className="text-xs text-ink-2">Saldos en Horizon Testnet:</span>
            <div className="mt-2 flex flex-wrap gap-3">
              {balances.platform.balances ? (
                balances.platform.balances.map((b) => (
                  <div key={b.asset} className="rounded-[8px] bg-fog px-3 py-2">
                    <span className="text-xs text-ink-2 font-medium">{b.asset}:</span>{" "}
                    <strong className="text-base font-bold text-ink tabular">{b.balance}</strong>
                  </div>
                ))
              ) : (
                <span className="text-xs text-warn">Cuenta sin crear en Testnet o Horizon no responde.</span>
              )}
            </div>
          </div>
        </div>

        {/* Cuenta Organizador de Prueba */}
        <div className="panel flex flex-col justify-between p-5 sm:p-6 border border-line shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF6EF] px-2.5 py-0.5 text-xs font-semibold text-[#14532D]">
                Cuenta Organizador de ejemplo
              </span>
              <span className="text-[11px] text-ink-3">Escrow Client</span>
            </div>
            <div className="mt-3">
              <span className="text-xs text-ink-2 font-medium">Clave Pública (Testnet):</span>
              <div className="mt-1 flex items-center gap-1.5">
                {balances.organizer.publicKey ? (
                  <a
                    href={explorerAccountUrl(balances.organizer.publicKey)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-accent hover:underline break-all"
                  >
                    {balances.organizer.publicKey} ↗
                  </a>
                ) : (
                  <span className="text-xs text-ink-3">Se crea con el primer cobro (o con npm run migrate:stellar).</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <span className="text-xs text-ink-2">Saldos en Horizon Testnet:</span>
            <div className="mt-2 flex flex-wrap gap-3">
              {balances.organizer.balances ? (
                balances.organizer.balances.map((b) => (
                  <div key={b.asset} className="rounded-[8px] bg-fog px-3 py-2">
                    <span className="text-xs text-ink-2 font-medium">{b.asset}:</span>{" "}
                    <strong className="text-base font-bold text-ink tabular">{b.balance}</strong>
                  </div>
                ))
              ) : (
                <span className="text-xs text-warn">Cuenta sin crear en Testnet o Horizon no responde.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Panel de Simulación para el Jurado */}
      <section className="panel p-5 sm:p-7 border border-line shadow-sm" aria-labelledby="h-simulador">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 id="h-simulador" className="m-0 text-xl font-bold text-ink">
              Simulador Interactivo de Liquidación en Testnet
            </h2>
            <p className="mt-1 mb-0 text-sm text-ink-2">
              Ejecuta el ciclo de vida completo: validación de código TILCA en boletería y liberación de fondos en Stellar Testnet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer bg-fog px-3 py-1.5 rounded-[6px] border border-line">
              <input
                type="checkbox"
                checked={offlineTest}
                onChange={(e) => setOfflineTest(e.target.checked)}
                className="rounded text-accent focus:ring-accent"
              />
              Simular caída de red (Contingencia)
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSimulate(offlineTest)}
            className="btn-primary h-12 px-6 text-base font-bold flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Procesando en Stellar Testnet...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Simular canje completo ({offlineTest ? "Modo Offline" : "Liquidación Real"})
              </>
            )}
          </button>

          <span className="text-xs text-ink-2 max-w-[40ch]">
            Genera un código dinámico <code>TILCA-XXXX</code>, certifica que es público nuevo y procesa la transacción en la red.
          </span>
        </div>

        {/* Resultado del simulador */}
        {lastResult && (
          <div
            className={`mt-6 rounded-[10px] border p-4 text-sm animate-pop-in ${
              lastResult.status === "cobrado"
                ? "border-[#B8DCC8] bg-[#EAF6EF] text-[#14532D]"
                : "border-warn/30 bg-[#FEF6EE] text-warn-ink"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {lastResult.status === "cobrado" ? "✅" : "⚠️"}
                </span>
                <strong className="font-bold">
                  Código {lastResult.code}: {lastResult.status === "cobrado" ? "Liquidación Exitosa" : "Entrada Aprobada (Cobro Pendiente)"}
                </strong>
              </div>
              {lastResult.txHash && (
                <a
                  href={lastResult.explorerUrl || explorerTxUrl(lastResult.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent hover:underline inline-flex items-center gap-1 text-xs"
                >
                  Ver transacción en Stellar Expert ↗
                </a>
              )}
            </div>
            <p className="mt-2 mb-0 text-xs text-inherit opacity-90 leading-relaxed">
              {lastResult.message}
            </p>
          </div>
        )}
      </section>

      {/* Historial de Movimientos en Vivo */}
      <section className="panel p-5 sm:p-6 border border-line shadow-xs" aria-labelledby="h-movimientos">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <h3 id="h-movimientos" className="m-0 text-base font-bold text-ink">
              Últimos movimientos en Testnet
            </h3>
            <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="link-underline text-xs text-ink-2 hover:text-ink cursor-pointer"
          >
            {isRefreshing ? "Actualizando..." : "↻ Refrescar datos"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm tabular">
            <thead>
              <tr className="text-left text-xs text-ink-2">
                <th className="py-2 pr-3 font-medium">Momento</th>
                <th className="py-2 pr-3 font-medium">Código TILCA</th>
                <th className="py-2 pr-3 font-medium">Monto</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 text-right font-medium">Comprobante Stellar</th>
              </tr>
            </thead>
            <tbody>
              {!transactions.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-ink-2">
                    Todavía no hay transacciones en esta sesión. Simula un canje para ver una real en Testnet.
                  </td>
                </tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-line hover:bg-fog/30 transition-colors">
                  <td className="py-2.5 pr-3 text-ink-2 text-xs">{t.time}</td>
                  <td className="py-2.5 pr-3 font-mono font-semibold text-ink">{t.code}</td>
                  <td className="py-2.5 pr-3 font-semibold text-ink">Bs {t.amountBs}.00</td>
                  <td className="py-2.5 pr-3">
                    {t.status === "cobrado" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6EF] px-2 py-0.5 text-[11px] font-semibold text-[#14532D]">
                        <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                        Cobrado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF6EE] px-2 py-0.5 text-[11px] font-semibold text-[#B43403]">
                        <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {t.txHash ? (
                      <a
                        href={explorerTxUrl(t.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-underline text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1"
                      >
                        Stellar Expert ↗
                      </a>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
