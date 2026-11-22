"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CATEGORIES, SALES_CHANNELS, type SalesChannel } from "@/lib/constants";
import { requireOrganizer } from "@/lib/organizer";
import { depositToEscrow } from "@/lib/stellar/escrow";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EventFormState {
  errors?: Record<string, string>;
  message?: string;
}

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function num(fd: FormData, key: string) {
  const v = str(fd, key).replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** "2026-11-27" + "20:00" en hora de La Paz (UTC-4) -> ISO. */
function laPazIso(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = /^\d{2}:\d{2}$/.test(time) ? time : "20:00";
  const d = new Date(`${date}T${t}:00-04:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function validUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export async function saveEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const { supabase, organizer } = await requireOrganizer();
  const intent = str(fd, "intent") === "publicar" ? "publicado" : "borrador";
  const id = str(fd, "id") || null;
  const errors: Record<string, string> = {};

  const title = str(fd, "title");
  const category = str(fd, "category");
  const startsAt = laPazIso(str(fd, "date"), str(fd, "time"));
  const endsAt = str(fd, "end_date") ? laPazIso(str(fd, "end_date"), "23:59") : null;
  const isFree = fd.get("is_free") === "on";
  const price = isFree ? 0 : num(fd, "price");
  const presalePrice = isFree ? null : num(fd, "presale_price");
  const presaleUntil = !isFree && str(fd, "presale_until") ? laPazIso(str(fd, "presale_until"), "23:59") : null;
  const capacity = num(fd, "capacity");
  const duration = num(fd, "duration_min");
  const lat = num(fd, "lat");
  const lng = num(fd, "lng");
  const ticketUrl = str(fd, "ticket_url");
  const trailerUrl = str(fd, "trailer_url");
  const posterUrl = str(fd, "poster_url");
  const deposit = num(fd, "promo_budget_bs");
  const expectedSales = isFree ? null : num(fd, "expected_sales");
  const discountCode = isFree ? "" : str(fd, "discount_code").toUpperCase().replace(/\s+/g, "");
  const discountAmount = isFree ? null : num(fd, "discount_amount");
  const discountUnit = str(fd, "discount_unit") === "pct" ? "pct" : "bs";
  const salesChannels = isFree
    ? []
    : SALES_CHANNELS.map((c) => c.id).filter((id): id is SalesChannel => fd.getAll("sales_channels").includes(id));
  const sellsOnline = salesChannels.includes("ticketera");

  // Siempre: título y categoría.
  if (!title) errors.title = "Escribe el título del evento.";
  if (!CATEGORIES.some((c) => c.id === category)) errors.category = "Elige una categoría.";
  if (Number.isNaN(price) || (price !== null && price < 0)) errors.price = "Escribe un precio válido.";
  if (Number.isNaN(presalePrice) || (presalePrice !== null && presalePrice < 0)) errors.presale_price = "Escribe un precio válido.";
  if (presalePrice !== null && !Number.isNaN(presalePrice) && !presaleUntil) errors.presale_until = "Indica hasta cuándo vale la preventa.";
  if (Number.isNaN(capacity) || (capacity !== null && capacity < 1)) errors.capacity = "Escribe el aforo en número de personas.";
  if (Number.isNaN(duration) || (duration !== null && duration < 1)) errors.duration_min = "Escribe la duración en minutos.";
  if (ticketUrl && !validUrl(ticketUrl)) errors.ticket_url = "El link debe empezar con https://";
  if (trailerUrl && !validUrl(trailerUrl)) errors.trailer_url = "El link debe empezar con https://";
  if (endsAt && startsAt && endsAt < startsAt) errors.end_date = "La fecha de cierre debe ser después del inicio.";
  if (discountCode && !/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(discountCode)) {
    errors.discount_code = "Usa solo letras, números y guiones, como TILCA10.";
  }
  if (Number.isNaN(discountAmount) || (discountAmount !== null && discountAmount <= 0)) errors.discount_amount = "Escribe un descuento válido.";
  if (discountUnit === "pct" && discountAmount !== null && discountAmount >= 100) errors.discount_amount = "El descuento debe ser menor a 100%.";
  if (Number.isNaN(expectedSales) || (expectedSales !== null && expectedSales < 0)) errors.expected_sales = "Escribe un número de entradas.";
  if (Number.isNaN(deposit) || (deposit !== null && deposit < 0)) errors.promo_budget_bs = "Escribe un monto válido.";

  // Para publicar: lo que necesita el mapa y la ficha.
  if (intent === "publicado") {
    if (!startsAt) errors.date = "Elige la fecha y la hora.";
    if (!str(fd, "venue_name")) errors.venue_name = "Escribe el nombre del lugar.";
    if (lat === null || lng === null) errors.location = "Marca el lugar en el mapa.";
    if (price === null) errors.price = "Escribe el precio o marca que es gratis.";
  }

  // Lo que ya está guardado: si es importado de una ticketera y el estado de su escrow.
  const { data: current } = id
    ? await supabase
        .from("events")
        .select("promo_budget_bs, escrow_status, source, source_url")
        .eq("id", id)
        .eq("organizer_id", organizer.id)
        .maybeSingle()
    : { data: null };
  const importedFrom: string | null = current?.source ?? null;
  const importedUrl: string | null = current?.source_url ?? null;

  // Eventos de pago publicados por el organizador: código TILCA y dónde vende.
  // (Los importados de una ticketera no tienen código: el organizador no está en TILCA.)
  if (intent === "publicado" && !isFree && !importedFrom) {
    if (!discountCode) errors.discount_code = "Escribe el código de descuento que creaste en tu ticketera.";
    if (!salesChannels.length) errors.sales_channels = "Marca al menos un lugar donde vendes.";
  }
  if (intent === "publicado" && !isFree && (sellsOnline || importedFrom) && !ticketUrl) {
    errors.ticket_url = "Pega el link donde se compran las entradas.";
  }

  if (Object.keys(errors).length) {
    return { errors, message: "Revisa los campos marcados." };
  }

  const row = {
    organizer_id: organizer.id,
    title,
    category,
    subcategory: str(fd, "subcategory") || null,
    status: intent,
    starts_at: startsAt,
    ends_at: endsAt,
    duration_min: duration,
    venue_name: str(fd, "venue_name") || null,
    venue_address: str(fd, "venue_address") || null,
    venue_zone: str(fd, "venue_zone") || null,
    lat,
    lng,
    price,
    presale_price: presalePrice,
    presale_until: presaleUntil,
    capacity,
    description: str(fd, "description") || null,
    poster_url: posterUrl || null,
    ticket_url: ticketUrl || null,
    trailer_url: trailerUrl || null,
    discount_code: discountCode || null,
    discount_amount: discountCode ? discountAmount : null,
    discount_unit: discountCode && discountAmount !== null ? discountUnit : null,
    sales_channels: salesChannels,
    expected_sales: expectedSales,
  };

  // Al publicar un evento importado, el equipo ya revisó lo que faltaba.
  const reviewed = importedFrom && intent === "publicado" ? { import_notes: null } : {};

  const res = id
    ? await supabase.from("events").update({ ...row, ...reviewed }).eq("id", id).eq("organizer_id", organizer.id).select("id").single()
    : await supabase.from("events").insert(row).select("id").single();
  if (res.error || !res.data) {
    return { message: "No pudimos guardar el evento. Inténtalo de nuevo." };
  }
  const eventId = res.data.id as string;

  // Depósito en el escrow. Lo escribe el servidor: el navegador no puede tocar esas columnas.
  // Mientras no haya un depósito hecho, el monto se puede cambiar; después, solo se agrega.
  let depositFailed = false;
  const status = current?.escrow_status ?? "sin_escrow";
  if (!isFree && !importedFrom && (status === "sin_escrow" || status === "deposito_pendiente")) {
    const amount = Math.round((deposit ?? 0) * 100) / 100;
    const nextStatus = amount > 0 && intent === "publicado" ? "deposito_pendiente" : "sin_escrow";
    await createAdminClient()
      .from("events")
      .update({ promo_budget_bs: amount, escrow_status: nextStatus })
      .eq("id", eventId)
      .eq("organizer_id", organizer.id);
    if (nextStatus === "deposito_pendiente") {
      const outcome = await depositToEscrow({ eventId, organizerId: organizer.id, initial: true });
      depositFailed = !outcome.ok;
    }
  }

  if (importedFrom && intent === "publicado" && lat !== null && lng !== null && row.venue_name) {
    const place = { lat, lng, venue_name: row.venue_name, venue_address: row.venue_address, venue_zone: row.venue_zone };
    // Las otras funciones del mismo evento: llevan lo mismo que el equipo acaba de revisar.
    if (importedUrl) {
      await supabase
        .from("events")
        .update({
          ...place,
          category: row.category,
          subcategory: row.subcategory,
          price: row.price,
          description: row.description,
          import_notes: null,
          status: "publicado",
        })
        .eq("organizer_id", organizer.id)
        .eq("source_url", importedUrl)
        .eq("status", "borrador");
    }
    await placeSiblingDrafts(supabase, organizer.id, row.venue_name, place);
  }

  revalidatePath("/", "layout");
  redirect(
    intent === "publicado"
      ? `/panel/evento/${eventId}?publicado=1${depositFailed ? "&deposito=pendiente" : ""}`
      : "/panel?tab=borradores",
  );
}

/**
 * Cuando el equipo ubica en el mapa un lugar de un evento importado, los otros
 * borradores importados en ese mismo lugar quedan ubicados también.
 */
async function placeSiblingDrafts(
  supabase: Awaited<ReturnType<typeof requireOrganizer>>["supabase"],
  organizerId: string,
  venueName: string,
  place: { lat: number; lng: number; venue_name: string; venue_address: string | null; venue_zone: string | null },
) {
  const { data: siblings } = await supabase
    .from("events")
    .select("id, import_notes")
    .eq("organizer_id", organizerId)
    .eq("venue_name", venueName)
    .eq("status", "borrador")
    .not("source", "is", null)
    .is("lat", null);
  for (const s of siblings ?? []) {
    const notes = (s.import_notes ?? "")
      .split("\n")
      .filter((n: string) => n && !n.startsWith("Ubica") && !n.startsWith("Confirma"));
    await supabase
      .from("events")
      .update({ ...place, import_notes: notes.length ? notes.join("\n") : null })
      .eq("id", s.id);
  }
}

export async function deleteDraft(fd: FormData) {
  const id = str(fd, "id");
  const { supabase, organizer } = await requireOrganizer();
  const { data: deleted } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .eq("status", "borrador")
    .select("source, source_key")
    .maybeSingle();
  // Un borrador importado que se borra no vuelve en la próxima importación.
  if (deleted?.source && deleted.source_key) {
    await createAdminClient()
      .from("import_ignored")
      .upsert({ source: deleted.source, source_key: deleted.source_key });
  }
  revalidatePath("/panel");
  redirect("/panel?tab=borradores");
}
