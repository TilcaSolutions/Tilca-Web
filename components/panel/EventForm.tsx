"use client";

/* eslint-disable @next/next/no-img-element -- vista previa de un archivo local */
import { startTransition, useActionState, useState } from "react";
import { saveEvent, type EventFormState } from "@/app/panel/evento/actions";
import { CATEGORIES, COMISION_LABEL, commissionFor, SALES_CHANNELS } from "@/lib/constants";
import { formatBs, lpParts } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { TilcaEvent } from "@/lib/types";
import { VENUES } from "@/lib/venues";
import { LocationPicker } from "../map/ClientMaps";
import { Poster } from "../Poster";

function isoToDate(iso: string | null) {
  if (!iso) return "";
  const p = lpParts(iso);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
function isoToTime(iso: string | null) {
  if (!iso) return "";
  const p = lpParts(iso);
  return `${p.hour}:${p.minute}`;
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <span id={`${id}-error`} className="text-sm text-danger">
      {error}
    </span>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && !error && <span className="text-[13px] text-ink-3">{hint}</span>}
      <FieldError id={id} error={error} />
    </div>
  );
}

export function EventForm({ event, userId }: { event?: TilcaEvent; userId: string }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(saveEvent, {});
  const e = state.errors ?? {};
  const isPublished = event?.status === "publicado";

  const [title, setTitle] = useState(event?.title ?? "");
  const [category, setCategory] = useState(event?.category ?? "teatro");
  const [isFree, setIsFree] = useState(event ? Number(event.price) === 0 && event.price !== null : false);
  const [venueName, setVenueName] = useState(event?.venue_name ?? "");
  const [venueAddress, setVenueAddress] = useState(event?.venue_address ?? "");
  const [venueZone, setVenueZone] = useState(event?.venue_zone ?? "");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    event?.lat != null && event?.lng != null ? { lat: event.lat, lng: event.lng } : null,
  );
  const [posterUrl, setPosterUrl] = useState(event?.poster_url ?? "");
  const [price, setPrice] = useState(event?.price != null ? String(event.price) : "");
  const [channels, setChannels] = useState<string[]>(event?.sales_channels ?? ["ticketera"]);
  const [expectedSales, setExpectedSales] = useState(event?.expected_sales != null ? String(event.expected_sales) : "");
  // Depósito sugerido = ventas esperadas × precio × 5%, hasta que el organizador lo cambie a mano.
  const [depositInput, setDepositInput] = useState<string | null>(
    event && Number(event.promo_budget_bs ?? 0) > 0 ? String(event.promo_budget_bs) : null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function pickVenue(name: string) {
    const v = VENUES.find((x) => x.name === name);
    if (!v) return;
    setVenueName(v.name);
    setVenueAddress(v.address);
    setVenueZone(v.zone);
    setLocation({ lat: v.lat, lng: v.lng });
  }

  async function uploadPoster(file: File) {
    setUploadError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setUploadError("Sube una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("La imagen pesa más de 5 MB.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("afiches").upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setUploadError("No pudimos subir el afiche. Inténtalo de nuevo.");
    } else {
      setPosterUrl(supabase.storage.from("afiches").getPublicUrl(path).data.publicUrl);
    }
    setUploading(false);
  }

  const isImported = !!event?.source;
  const escrowStatus = event?.escrow_status ?? "sin_escrow";
  const depositLocked = escrowStatus !== "sin_escrow" && escrowStatus !== "deposito_pendiente";
  const suggested = commissionFor(Number(expectedSales) || 0, Number(price) || 0);
  const depositValue = depositInput ?? (suggested > 0 ? String(suggested) : "");
  const sellsOnline = channels.includes("ticketera");

  const aria = (id: string) => (e[id] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {});
  const sectionTitle = "m-0 text-base font-semibold";

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(ev) => {
        // Enviar sin que React reinicie el formulario: si hay errores, no se pierde lo escrito.
        ev.preventDefault();
        const submitter = (ev.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(ev.currentTarget);
        fd.set("intent", submitter?.value ?? "publicar");
        startTransition(() => action(fd));
      }}
    >
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="poster_url" value={posterUrl} />
      <input type="hidden" name="lat" value={location?.lat ?? ""} />
      <input type="hidden" name="lng" value={location?.lng ?? ""} />

      <section className="panel flex flex-col gap-4 p-5 sm:p-6">
        <h2 className={sectionTitle}>El evento</h2>
        <Field id="title" label="Título" error={e.title}>
          <input id="title" name="title" value={title} onChange={(ev) => setTitle(ev.target.value)} className="field" required {...aria("title")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="category" label="Categoría" error={e.category}>
            <select
              id="category"
              name="category"
              value={category}
              onChange={(ev) => setCategory(ev.target.value as typeof category)}
              className="field"
              {...aria("category")}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="subcategory" label="Tipo (opcional)" hint="Por ejemplo: comedia, exposición, jazz">
            <input id="subcategory" name="subcategory" defaultValue={event?.subcategory ?? ""} className="field" />
          </Field>
        </div>
        <Field id="description" label="Descripción" hint="Cuéntale al público de qué se trata y para quién es.">
          <textarea id="description" name="description" rows={4} defaultValue={event?.description ?? ""} className="field" />
        </Field>
      </section>

      <section className="panel flex flex-col gap-4 p-5 sm:p-6">
        <h2 className={sectionTitle}>Fecha y hora</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="date" label="Fecha" error={e.date}>
            <input id="date" name="date" type="date" defaultValue={isoToDate(event?.starts_at ?? null)} className="field" {...aria("date")} />
          </Field>
          <Field id="time" label="Hora">
            <input id="time" name="time" type="time" defaultValue={isoToTime(event?.starts_at ?? null) || "20:00"} className="field" />
          </Field>
          <Field id="duration_min" label="Duración en minutos" error={e.duration_min}>
            <input
              id="duration_min"
              name="duration_min"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={event?.duration_min ?? ""}
              className="field"
              {...aria("duration_min")}
            />
          </Field>
        </div>
        <Field id="end_date" label="Último día (opcional)" hint="Para exposiciones o temporadas de varias fechas." error={e.end_date}>
          <input id="end_date" name="end_date" type="date" defaultValue={isoToDate(event?.ends_at ?? null)} className="field sm:max-w-[240px]" {...aria("end_date")} />
        </Field>
      </section>

      <section className="panel flex flex-col gap-4 p-5 sm:p-6">
        <h2 className={sectionTitle}>Lugar</h2>
        <Field id="venue_pick" label="Elige un lugar conocido" hint="O escribe otro y márcalo en el mapa.">
          <select id="venue_pick" className="field" value={VENUES.some((v) => v.name === venueName) ? venueName : ""} onChange={(ev) => pickVenue(ev.target.value)}>
            <option value="">Otro lugar</option>
            {VENUES.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
          <Field id="venue_name" label="Nombre del lugar" error={e.venue_name}>
            <input id="venue_name" name="venue_name" value={venueName} onChange={(ev) => setVenueName(ev.target.value)} className="field" {...aria("venue_name")} />
          </Field>
          <Field id="venue_address" label="Dirección">
            <input id="venue_address" name="venue_address" value={venueAddress} onChange={(ev) => setVenueAddress(ev.target.value)} className="field" />
          </Field>
          <Field id="venue_zone" label="Zona">
            <input id="venue_zone" name="venue_zone" value={venueZone} onChange={(ev) => setVenueZone(ev.target.value)} placeholder="Sopocachi" className="field" />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label" id="location-label">
            Ubicación en el mapa
          </span>
          <span className="text-[13px] text-ink-3">
            {location ? "Arrastra el pin o toca el mapa para moverlo." : "Toca el mapa donde queda el lugar."}
          </span>
          <div
            role="group"
            aria-labelledby="location-label"
            className={`relative h-[300px] overflow-hidden rounded-control border ${e.location ? "border-danger" : "border-line"}`}
          >
            <LocationPicker value={location} onChange={setLocation} />
          </div>
          <FieldError id="location" error={e.location} />
        </div>
      </section>

      <section className="panel flex flex-col gap-4 p-5 sm:p-6">
        <h2 className={sectionTitle}>Entradas</h2>
        <label className="flex items-center gap-2.5 text-[15px]">
          <input type="checkbox" name="is_free" checked={isFree} onChange={(ev) => setIsFree(ev.target.checked)} className="h-5 w-5 accent-primary" />
          Es gratis
        </label>
        {!isFree && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="price" label="Precio en Bs" error={e.price}>
              <input
                id="price"
                name="price"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={price}
                onChange={(ev) => setPrice(ev.target.value)}
                className="field"
                {...aria("price")}
              />
            </Field>
            <Field id="presale_price" label="Preventa en Bs (opcional)" error={e.presale_price}>
              <input
                id="presale_price"
                name="presale_price"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                defaultValue={event?.presale_price ?? ""}
                className="field"
                {...aria("presale_price")}
              />
            </Field>
            <Field id="presale_until" label="Preventa hasta" error={e.presale_until}>
              <input
                id="presale_until"
                name="presale_until"
                type="date"
                defaultValue={isoToDate(event?.presale_until ?? null)}
                className="field"
                {...aria("presale_until")}
              />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field id="capacity" label="Aforo" hint="Cuántas personas entran." error={e.capacity}>
            <input
              id="capacity"
              name="capacity"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={event?.capacity ?? ""}
              className="field"
              {...aria("capacity")}
            />
          </Field>
          <Field
            id="ticket_url"
            label={isFree ? "Link para reservar (opcional)" : sellsOnline || isImported ? "Link de compra" : "Link de compra (opcional)"}
            hint="Tu página en la ticketera. El botón “Comprar entrada” lleva ahí."
            error={e.ticket_url}
          >
            <input
              id="ticket_url"
              name="ticket_url"
              type="url"
              inputMode="url"
              placeholder="https://superticket.bo/..."
              defaultValue={event?.ticket_url ?? ""}
              className="field"
              {...aria("ticket_url")}
            />
          </Field>
        </div>
      </section>

      {!isFree && !isImported && (
        <section className="panel flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="h-venta-tilca">
          <div>
            <h2 id="h-venta-tilca" className={sectionTitle}>
              Venta con código TILCA
            </h2>
            <p className="mt-1 mb-0 text-sm text-ink-2">
              Crea en tu ticketera un código de descuento para TILCA. El público lo ve en la ficha y compra con él. Publicar es
              gratis: TILCA cobra el {COMISION_LABEL} de cada entrada que vendemos con ese código.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr_1fr]">
            <Field id="discount_code" label="Código de descuento TILCA" hint="El mismo que creaste en tu ticketera." error={e.discount_code}>
              <input
                id="discount_code"
                name="discount_code"
                defaultValue={event?.discount_code ?? ""}
                placeholder="TILCA10"
                autoCapitalize="characters"
                className="field font-semibold uppercase tracking-wide"
                {...aria("discount_code")}
              />
            </Field>
            <Field id="discount_amount" label="Descuento que da (opcional)" hint="Solo se muestra al público." error={e.discount_amount}>
              <input
                id="discount_amount"
                name="discount_amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                defaultValue={event?.discount_amount ?? ""}
                className="field"
                {...aria("discount_amount")}
              />
            </Field>
            <Field id="discount_unit" label="En">
              <select id="discount_unit" name="discount_unit" defaultValue={event?.discount_unit ?? "bs"} className="field">
                <option value="bs">Bolivianos</option>
                <option value="pct">Porcentaje</option>
              </select>
            </Field>
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-describedby={e.sales_channels ? "sales_channels-error" : undefined}>
            <legend className="label mb-1.5">Dónde vendes</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {SALES_CHANNELS.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5 text-[15px]">
                  <input
                    type="checkbox"
                    name="sales_channels"
                    value={c.id}
                    checked={channels.includes(c.id)}
                    onChange={(ev) => setChannels((prev) => (ev.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))}
                    className="h-5 w-5 accent-primary"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <FieldError id="sales_channels" error={e.sales_channels} />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="expected_sales" label="Ventas que esperas de TILCA" hint="Entradas, por ejemplo 30." error={e.expected_sales}>
              <input
                id="expected_sales"
                name="expected_sales"
                type="number"
                inputMode="numeric"
                min={0}
                value={expectedSales}
                onChange={(ev) => setExpectedSales(ev.target.value)}
                className="field"
                {...aria("expected_sales")}
              />
            </Field>
            {depositLocked ? (
              <div className="flex flex-col gap-1.5">
                <span className="label">Depósito</span>
                <span className="flex min-h-11 items-center rounded-control border border-line bg-fog px-3 text-[15px] font-semibold">
                  {formatBs(event?.promo_budget_bs)} depositados
                </span>
                <span className="text-[13px] text-ink-3">Para agregar más, ve a Presupuesto y cobros.</span>
              </div>
            ) : (
              <Field
                id="promo_budget_bs"
                label="Depósito en Bs"
                error={e.promo_budget_bs}
                hint={
                  suggested > 0
                    ? `Sugerido: ${expectedSales} entradas × ${formatBs(Number(price))} × ${COMISION_LABEL} = ${formatBs(suggested)}.`
                    : `Ventas esperadas × precio × ${COMISION_LABEL}.`
                }
              >
                <input
                  id="promo_budget_bs"
                  name="promo_budget_bs"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={depositValue}
                  onChange={(ev) => setDepositInput(ev.target.value)}
                  className="field"
                  {...aria("promo_budget_bs")}
                />
              </Field>
            )}
          </div>
          <p className="m-0 rounded-control border border-line/60 bg-fog p-3.5 text-[13px] leading-relaxed text-ink-2">
            El depósito queda en garantía (escrow) hasta que cierres el evento. Al cerrar, TILCA cobra el {COMISION_LABEL} de las
            entradas que confirmes y te devuelve el resto. Cada movimiento tiene su comprobante público.
          </p>
        </section>
      )}

      <section className="panel flex flex-col gap-4 p-5 sm:p-6">
        <h2 className={sectionTitle}>Afiche</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {posterUrl ? (
            <img src={posterUrl} alt="Vista previa del afiche" className="h-[224px] w-[168px] flex-none rounded-[6px] object-cover" />
          ) : (
            <Poster size="lg" title={title || "Tu evento"} category={category} />
          )}
          <div className="flex flex-col gap-2 text-[15px]">
            <p className="m-0 text-ink-2">
              {posterUrl
                ? "Este es tu afiche."
                : "Si no subes uno, TILCA genera un afiche con el color de la categoría y el título."}
            </p>
            <label className="btn-secondary h-11 cursor-pointer self-start px-4 text-[15px] focus-within:outline-2 focus-within:outline-primary">
              {uploading ? "Subiendo…" : posterUrl ? "Cambiar afiche" : "Subir afiche"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) void uploadPoster(f);
                }}
              />
            </label>
            {posterUrl && (
              <button type="button" onClick={() => setPosterUrl("")} className="link-underline self-start text-sm text-ink-2">
                Quitar afiche
              </button>
            )}
            <span className="text-[13px] text-ink-3">JPG, PNG o WebP, hasta 5 MB. Mejor en vertical (3:4).</span>
            {uploadError && (
              <span role="alert" className="text-sm text-danger">
                {uploadError}
              </span>
            )}
          </div>
        </div>
        <Field id="trailer_url" label="Link del adelanto (opcional)" hint="Un video corto en YouTube, Instagram o TikTok." error={e.trailer_url}>
          <input id="trailer_url" name="trailer_url" type="url" inputMode="url" defaultValue={event?.trailer_url ?? ""} className="field" {...aria("trailer_url")} />
        </Field>
      </section>

      {state.message && (
        <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          {state.message}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-line bg-fog/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        {!isPublished && (
          <button type="submit" name="intent" value="borrador" disabled={pending || uploading} className="btn-secondary h-12 px-5 text-[15px]">
            Guardar borrador
          </button>
        )}
        <button type="submit" name="intent" value="publicar" disabled={pending || uploading} className="btn-primary h-12 px-6 text-base">
          {pending ? "Guardando…" : isPublished ? "Guardar cambios" : "Publicar evento"}
        </button>
      </div>
    </form>
  );
}
