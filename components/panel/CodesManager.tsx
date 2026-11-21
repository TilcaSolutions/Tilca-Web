"use client";

import { useActionState, useRef } from "react";
import { importCsv, redeemCode, type CsvState, type RedeemState } from "@/app/panel/actions";

function Message({ state }: { state: { message?: string; tone?: "ok" | "error" } }) {
  if (!state.message) return null;
  return (
    <p
      role={state.tone === "error" ? "alert" : "status"}
      className={`m-0 text-sm ${state.tone === "ok" ? "font-semibold text-ok" : "text-[#B3261E]"}`}
    >
      {state.message}
    </p>
  );
}

/** Canjear códigos uno por uno o subir un CSV con los códigos usados. */
export function CodesManager() {
  const [redeemState, redeemAction, redeeming] = useActionState<RedeemState, FormData>(redeemCode, {});
  const [csvState, csvAction, importing] = useActionState<CsvState, FormData>(importCsv, {});
  const codeRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={redeemAction} className="flex flex-col gap-2.5" onSubmit={() => setTimeout(() => codeRef.current?.focus(), 0)}>
        <label htmlFor="code" className="label">
          Canjear un código
        </label>
        <div className="flex gap-2">
          <input
            ref={codeRef}
            id="code"
            name="code"
            placeholder="TILCA-4F7K"
            autoComplete="off"
            autoCapitalize="characters"
            className="field uppercase tabular"
          />
          <button type="submit" disabled={redeeming} className="btn-secondary h-11 flex-none px-4 text-[15px]">
            {redeeming ? "Canjeando…" : "Canjear"}
          </button>
        </div>
        <label className="flex items-center gap-2.5 text-[15px]">
          <input type="checkbox" name="is_new" defaultChecked className="h-5 w-5 accent-[#17191E]" />
          Es público nuevo: nunca compró una entrada mía
        </label>
        <Message state={redeemState} />
      </form>

      <form action={csvAction} className="flex flex-col gap-2.5">
        <label htmlFor="csv" className="label">
          Subir un CSV con los códigos usados
        </label>
        <div className="flex gap-2">
          <input id="csv" name="file" type="file" accept=".csv,text/csv,text/plain" className="field pt-2.5 text-sm" />
          <button type="submit" disabled={importing} className="btn-secondary h-11 flex-none px-4 text-[15px]">
            {importing ? "Subiendo…" : "Subir"}
          </button>
        </div>
        <span className="text-[13px] leading-normal text-ink-3">
          Una columna <code>codigo</code> y, si quieres, una columna <code>nuevo</code> con sí o no. Puedes exportarlo de tu ticketera.
        </span>
        <Message state={csvState} />
      </form>
    </div>
  );
}
