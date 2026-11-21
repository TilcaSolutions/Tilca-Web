"use client";

import { useState, useTransition } from "react";
import { addEventBudget, closeEventAndRefund } from "@/app/panel/actions";
import { BS_PER_ATTENDEE } from "@/lib/stellar/config";

interface BudgetManagerProps {
  eventId: string;
  currentBalance: number;
  escrowStatus: string;
}

export function BudgetManager({
  eventId,
  currentBalance,
  escrowStatus,
}: BudgetManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [amountBs, setAmountBs] = useState<number>(100);
  const [isPending, startTransition] = useTransition();

  const additionalAttendees = Math.floor(amountBs / BS_PER_ATTENDEE);

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await addEventBudget(formData);
      setShowAddModal(false);
    });
  };

  const handleCloseSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await closeEventAndRefund(formData);
      setShowCloseModal(false);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="btn-primary h-9 px-4 text-sm font-semibold flex items-center gap-1.5 shadow-sm"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Agregar presupuesto
        </button>

        {escrowStatus !== "reembolsado" && currentBalance > 0 && (
          <button
            type="button"
            onClick={() => setShowCloseModal(true)}
            className="btn-secondary h-9 px-3.5 text-sm text-ink-2 hover:text-ink hover:border-warn-strong"
          >
            Cerrar evento y recuperar saldo
          </button>
        )}
      </div>

      {/* Modal: Agregar Presupuesto */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="panel w-full max-w-md p-6 shadow-xl animate-pop-in border border-line">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-bold text-ink">Agregar presupuesto de promoción</h3>
                <p className="mt-1 text-sm text-ink-2">
                  Deposita fondos adicionales en el Escrow de Stellar Testnet para cubrir más asistentes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-1 text-ink-3 hover:bg-fog hover:text-ink"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-5 flex flex-col gap-4">
              <input type="hidden" name="event_id" value={eventId} />

              <div>
                <label htmlFor="amount_bs" className="block text-sm font-medium text-ink">
                  Monto a depositar (en Bolivianos)
                </label>
                <div className="relative mt-1.5 flex items-center">
                  <span className="absolute left-3 text-sm font-semibold text-ink-2">Bs</span>
                  <input
                    id="amount_bs"
                    name="amount_bs"
                    type="number"
                    min="5"
                    step="5"
                    value={amountBs}
                    onChange={(e) => setAmountBs(Math.max(5, Number(e.target.value) || 0))}
                    className="field h-10 w-full pl-10 pr-3 text-base font-semibold tabular"
                    required
                  />
                </div>
              </div>

              {/* Botones de montos rápidos */}
              <div className="flex flex-wrap gap-2">
                {[50, 100, 250, 500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmountBs(val)}
                    className={`h-7 rounded-[6px] px-2.5 text-xs font-medium border transition-colors ${
                      amountBs === val
                        ? "bg-accent/10 border-accent text-accent font-semibold"
                        : "border-line bg-fog text-ink-2 hover:border-ink-3"
                    }`}
                  >
                    + Bs {val}
                  </button>
                ))}
              </div>

              <div className="rounded-[8px] bg-fog p-3 text-xs text-ink-2 leading-relaxed">
                Con <strong className="text-ink font-semibold">Bs {amountBs}</strong> adicionales cubres{" "}
                <strong className="text-ink font-semibold">{additionalAttendees} asistentes nuevos</strong> a Bs 5 cada uno. Los fondos no utilizados se pueden recuperar en cualquier momento.
              </div>

              <div className="mt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary h-9 px-3.5 text-sm"
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary h-9 px-4 text-sm font-semibold"
                >
                  {isPending ? "Confirmando en Stellar..." : "Confirmar depósito"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cerrar Evento y Recuperar Saldo */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="panel w-full max-w-md p-6 shadow-xl animate-pop-in border border-line">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-bold text-ink">Recuperar saldo y cerrar promoción</h3>
                <p className="mt-1 text-sm text-ink-2">
                  El saldo restante del Escrow volverá a la cuenta del organizador en Stellar Testnet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="rounded-full p-1 text-ink-3 hover:bg-fog hover:text-ink"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-[8px] border border-warn/30 bg-[#FEF6EE] p-4 text-sm text-warn-ink">
              <div className="font-semibold text-warn">Saldo disponible a reembolsar:</div>
              <div className="font-condensed mt-1 text-2xl font-bold text-ink">
                Bs {currentBalance.toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-ink-2">
                El contrato de Escrow se marcará como cerrado y no se liberarán más pagos automáticos para este evento.
              </div>
            </div>

            <form onSubmit={handleCloseSubmit} className="mt-5 flex items-center justify-end gap-2.5">
              <input type="hidden" name="event_id" value={eventId} />
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="btn-secondary h-9 px-3.5 text-sm"
                disabled={isPending}
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary h-9 px-4 text-sm font-semibold bg-warn-strong hover:bg-warn-strong/90 text-white"
              >
                {isPending ? "Reembolsando en Stellar..." : "Confirmar reembolso"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
