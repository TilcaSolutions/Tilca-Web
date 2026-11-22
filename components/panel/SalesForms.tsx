"use client";

import { useActionState, useState } from "react";
import { addDeposit, closeEvent, confirmTicketSales, type SalesState } from "@/app/panel/actions";
import { formatBs } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

function Message({ state }: { state: SalesState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.tone === "error" ? "alert" : "status"}
      className={`m-0 rounded-control px-3 py-2 text-sm ${
        state.tone === "error" ? "border border-warn-line bg-warn-bg text-warn-ink" : "bg-primary-soft text-primary"
      }`}
    >
      {state.message}
    </p>
  );
}

/** Ventas por ticketera: cantidad + respaldo opcional (captura o CSV del reporte). */
export function TicketSalesForm({ eventId, userId }: { eventId: string; userId: string }) {
  const [state, action, pending] = useActionState(confirmTicketSales, {});
  const [evidence, setEvidence] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploadError(null);
    const isImage = /^image\/(jpeg|png|webp)$/.test(file.type);
    const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
    if (!isImage && !isCsv) return setUploadError("Sube una captura (JPG, PNG o WebP) o un CSV.");
    if (file.size > 5 * 1024 * 1024) return setUploadError("El archivo pesa más de 5 MB.");
    setUploading(true);
    const ext = isCsv ? "csv" : file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${userId}/${eventId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient()
      .storage.from("respaldos")
      .upload(path, file, { contentType: isCsv ? "text/csv" : file.type, upsert: false });
    setUploading(false);
    if (error) return setUploadError("No pudimos subir el respaldo. Inténtalo de nuevo.");
    setEvidence({ path, name: file.name });
  }

  return (
    <form
      action={action}
      // El FormData ya se armó con el respaldo; se limpia para la próxima confirmación.
      onSubmit={() => setEvidence(null)}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="evidence_path" value={evidence?.path ?? ""} />
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quantity" className="label">
            Entradas vendidas con el código
          </label>
          <input id="quantity" name="quantity" type="number" inputMode="numeric" min={1} required className="field h-11 w-40 tabular" />
        </div>
        <label className="btn-secondary h-11 cursor-pointer px-4 text-[15px] focus-within:outline-2 focus-within:outline-primary">
          {uploading ? "Subiendo…" : evidence ? "Cambiar respaldo" : "Subir respaldo (opcional)"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.csv,text/csv"
            className="sr-only"
            disabled={uploading}
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) void upload(f);
              ev.target.value = "";
            }}
          />
        </label>
        <button type="submit" disabled={pending || uploading} className="btn-primary h-11 px-5 text-[15px]">
          {pending ? "Guardando…" : "Confirmar ventas"}
        </button>
      </div>
      <span className="text-[13px] text-ink-3">
        {evidence ? `Respaldo: ${evidence.name}` : "Una captura o el CSV del reporte de tu ticketera, filtrado por el código."}
      </span>
      {uploadError && (
        <span role="alert" className="text-sm text-danger">
          {uploadError}
        </span>
      )}
      <Message state={state} />
    </form>
  );
}

/** Depósito adicional en el escrow. */
export function DepositForm({ eventId, suggested, label = "Depositar" }: { eventId: string; suggested?: number; label?: string }) {
  const [state, action, pending] = useActionState(addDeposit, {});
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`amount-${eventId}`} className="label">
            Monto en Bs
          </label>
          <input
            id={`amount-${eventId}`}
            name="amount_bs"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="any"
            defaultValue={suggested ? suggested : ""}
            required
            className="field h-11 w-40 tabular"
          />
        </div>
        <button type="submit" disabled={pending} className="btn-primary h-11 px-5 text-[15px]">
          {pending ? "Depositando…" : label}
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}

/** Cerrar el evento: comisión a TILCA y devolución del resto. */
export function CloseEventForm({ eventId, commission, refund, retry }: { eventId: string; commission: number; refund: number; retry?: boolean }) {
  const [state, action, pending] = useActionState(closeEvent, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary h-12 px-6 text-base">
          {pending ? "Cerrando en Stellar…" : retry ? "Reintentar el cobro" : "Cerrar el evento"}
        </button>
        <span className="text-sm text-ink-2">
          Se liberan {formatBs(commission)} a TILCA y vuelven {formatBs(refund)} a tu cuenta.
        </span>
      </div>
      <Message state={state} />
      {state.missingBs ? <DepositForm eventId={eventId} suggested={state.missingBs} label="Depositar lo que falta" /> : null}
    </form>
  );
}
