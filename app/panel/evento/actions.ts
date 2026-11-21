"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";
import { requireOrganizer } from "@/lib/organizer";
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
  const promoBudget = Math.max(0, num(fd, "promo_budget_bs") ?? 0);

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

  // Para publicar: lo que necesita el mapa y la ficha.
  if (intent === "publicado") {
    if (!startsAt) errors.date = "Elige la fecha y la hora.";
    if (!str(fd, "venue_name")) errors.venue_name = "Escribe el nombre del lugar.";
    if (lat === null || lng === null) errors.location = "Marca el lugar en el mapa.";
    if (price === null) errors.price = "Escribe el precio o marca que es gratis.";
    if (!ticketUrl && !isFree) errors.ticket_url = "Pega el link donde se compran las entradas.";
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
  };

  // Presupuesto: al editar se conserva lo ya usado en cobros y el escrow existente.
  let budget: Record<string, unknown>;
  let importedFrom: string | null = null;
  let importedUrl: string | null = null;
  if (id) {
    const { data: current } = await supabase
      .from("events")
      .select("promo_budget_bs, escrow_balance_bs, escrow_status, stellar_escrow_id, source, source_url")
      .eq("id", id)
      .eq("organizer_id", organizer.id)
      .maybeSingle();
    importedFrom = current?.source ?? null;
    importedUrl = current?.source_url ?? null;
    const oldBudget = Number(current?.promo_budget_bs ?? 0);
    const used = Math.max(0, oldBudget - Number(current?.escrow_balance_bs ?? 0));
    const closed = current?.escrow_status === "reembolsado" || current?.escrow_status === "cerrado";
    if (closed && promoBudget !== oldBudget) {
      return { errors: { promo_budget_bs: "La promoción de este evento ya se cerró." }, message: "Revisa los campos marcados." };
    }
    if (promoBudget < used) {
      return {
        errors: { promo_budget_bs: `Ya se usaron Bs ${used} en cobros; el presupuesto no puede ser menor.` },
        message: "Revisa los campos marcados.",
      };
    }
    const balance = promoBudget - used;
    budget = closed
      ? {}
      : {
          promo_budget_bs: promoBudget,
          escrow_balance_bs: balance,
          escrow_status: promoBudget === 0 ? "sin_escrow" : balance > 0 ? "activo" : "agotado",
          stellar_escrow_id: current?.stellar_escrow_id ?? (promoBudget > 0 ? newEscrowId() : null),
        };
  } else {
    budget = {
      promo_budget_bs: promoBudget,
      escrow_balance_bs: promoBudget,
      escrow_status: promoBudget > 0 ? "activo" : "sin_escrow",
      stellar_escrow_id: promoBudget > 0 ? newEscrowId() : null,
    };
  }

  // Al publicar un evento importado, el equipo ya revisó lo que faltaba.
  const reviewed = importedFrom && intent === "publicado" ? { import_notes: null } : {};

  const res = id
    ? await supabase.from("events").update({ ...row, ...budget, ...reviewed }).eq("id", id).eq("organizer_id", organizer.id).select("id").single()
    : await supabase.from("events").insert({ ...row, ...budget }).select("id").single();
  if (res.error || !res.data) {
    return { message: "No pudimos guardar el evento. Inténtalo de nuevo." };
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
  redirect(intent === "publicado" ? `/panel/evento/${res.data.id}?publicado=1` : "/panel?tab=borradores");
}

function newEscrowId() {
  return `TW-ESCROW-${Date.now().toString(36).toUpperCase()}`;
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
