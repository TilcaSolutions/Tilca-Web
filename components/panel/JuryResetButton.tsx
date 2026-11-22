"use client";

import { useFormStatus } from "react-dom";

/** Botón de "Restablecer datos de ejemplo": tarda alrededor de un minuto (hace transacciones en Stellar). */
export function JuryResetButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(ev) => {
        if (!confirm("¿Restablecer los datos de ejemplo? Se borra lo que cambiaste y se recargan los cobros en Stellar (tarda cerca de un minuto).")) ev.preventDefault();
      }}
      className="font-semibold underline underline-offset-2 disabled:no-underline"
    >
      {pending ? "Restableciendo… (cerca de un minuto)" : "Restablecer datos de ejemplo"}
    </button>
  );
}
