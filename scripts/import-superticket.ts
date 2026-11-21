/**
 * Importa a TILCA los próximos eventos culturales de La Paz que vende Superticket.
 *
 *   npm run import:superticket            # importa
 *   npm run import:superticket -- --dry   # solo muestra qué haría
 *
 * - Lee la portada de superticket.bo y el bloque schema.org/Event de cada evento,
 *   una página por segundo.
 * - Deja fuera otras ciudades y lo que no es agenda cultural (concursos, deporte, fiestas).
 * - Publica directo solo lo que puede confirmar: lugar ubicado en La Paz, precio y categoría.
 *   El resto queda en borrador con una nota de qué revisar (en el panel de "Cartelera TILCA").
 * - Cuando ubicas un lugar en el mapa una vez, los próximos eventos ahí ya entran ubicados.
 * - No duplica: cada función tiene una clave estable, y salta eventos que un organizador ya publicó.
 */
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  SUPERTICKET,
  SUPERTICKET_HOME,
  classify,
  detectCity,
  normalizeName,
  parseEventLinks,
  parseEventPage,
  type SourceEvent,
} from "../lib/import/superticket";
import { VENUES } from "../lib/venues";

const DRY = process.argv.includes("--dry");
const USER_AGENT = "TILCA-importer/0.1 (agenda cultural de La Paz)";
const DELAY_MS = 1100;
const MAX_PAGES = 200;
const ORG_NAME = "Cartelera TILCA";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (ver README).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(pageUrl: string) {
  const res = await fetch(pageUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} en ${pageUrl}`);
  return res.text();
}

/** Día en La Paz (UTC-4) de una fecha ISO, para comparar eventos. */
const lpDay = (iso: string) => new Date(Date.parse(iso) - 4 * 3600_000).toISOString().slice(0, 10);

// --- Organizador "Cartelera TILCA" -----------------------------------------------

/**
 * La cuenta del equipo que revisa los eventos importados (IMPORT_OWNER_EMAIL).
 * En local, si no existe, se crea con una contraseña aleatoria que se muestra una vez.
 */
async function cartelera(): Promise<string> {
  const isLocal = /127\.0\.0\.1|localhost/.test(url!);
  const email = process.env.IMPORT_OWNER_EMAIL ?? (isLocal ? "cartelera@tilca.bo" : undefined);
  if (!email) {
    throw new Error(
      `Falta IMPORT_OWNER_EMAIL: regístrate como organizador "${ORG_NAME}" en /registro y pon ese correo en las variables de entorno.`,
    );
  }

  const { data: users, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  let user = users.users.find((u) => u.email === email);
  if (!user) {
    if (!isLocal) throw new Error(`No existe la cuenta ${email}. Regístrala como organizador en /registro.`);
    const password = randomBytes(9).toString("base64url");
    const created = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "organizador", org_name: ORG_NAME },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error("No se creó la cuenta de la cartelera");
    user = created.data.user;
    console.log(`Cuenta para revisar lo importado: ${email} / ${password} (guárdala, no se vuelve a mostrar)\n`);
  }

  const { data: org } = await db.from("organizers").select("id").eq("owner_id", user.id).maybeSingle();
  if (org) return org.id;
  const { data: made, error: orgErr } = await db
    .from("organizers")
    .insert({ owner_id: user.id, name: ORG_NAME })
    .select("id")
    .single();
  if (orgErr) throw orgErr;
  await db.from("profiles").update({ role: "organizador" }).eq("id", user.id);
  return made.id;
}

// --- Lugares conocidos -----------------------------------------------------------

interface KnownVenue {
  name: string;
  address: string | null;
  zone: string | null;
  lat: number;
  lng: number;
  /** true si sabemos que está en La Paz (no es solo un nombre que coincide). */
  confirmed: boolean;
}

/** Nombres genéricos que también existen en otras ciudades: dan coordenadas pero no confirman la ciudad. */
const AMBIGUOUS = new Set(["casa de la cultura", "catedral metropolitana", "teatro municipal"]);

/** Cómo llama Superticket a lugares que ya están en lib/venues.ts. */
const ALIASES: Record<string, string> = {
  "Teatro Modesta Sanjinés Casa de la Cultura": "Casa de la Cultura",
};

async function knownVenues(orgId: string) {
  const venues = new Map<string, KnownVenue>();
  for (const v of VENUES) {
    const n = normalizeName(v.name);
    venues.set(n, { ...v, confirmed: !AMBIGUOUS.has(n) });
  }
  for (const [alias, target] of Object.entries(ALIASES)) {
    const v = VENUES.find((x) => x.name === target);
    if (v) venues.set(normalizeName(alias), { ...v, name: alias, confirmed: true });
  }
  // Lo que el equipo ya ubicó en el mapa en eventos importados: eso sí está confirmado.
  const { data } = await db
    .from("events")
    .select("venue_name, venue_address, venue_zone, lat, lng")
    .eq("organizer_id", orgId)
    .not("lat", "is", null)
    .not("venue_name", "is", null)
    .order("updated_at", { ascending: false });
  for (const e of data ?? []) {
    const n = normalizeName(e.venue_name!);
    if (!venues.get(n)?.confirmed) {
      venues.set(n, { name: e.venue_name!, address: e.venue_address, zone: e.venue_zone, lat: e.lat!, lng: e.lng!, confirmed: true });
    }
  }
  return venues;
}

// --- Importación -----------------------------------------------------------------

interface Row {
  title: string;
  category: string;
  status: "borrador" | "publicado";
  starts_at: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_zone: string | null;
  lat: number | null;
  lng: number | null;
  price: number | null;
  poster_url: string | null;
  ticket_url: string;
  source_url: string;
  import_notes: string | null;
}

function buildRow(ev: SourceEvent, startsAt: string, venue: KnownVenue | undefined, cityOk: boolean, cat: { category: string; guess: boolean }): Row {
  const notes: string[] = [];
  if (!venue) notes.push("Ubica el lugar en el mapa (la próxima vez que haya un evento ahí ya entra ubicado).");
  if (!cityOk) notes.push("Confirma que es en La Paz: Superticket no dice la ciudad.");
  if (ev.price === null) notes.push("Precio por confirmar: Superticket no lo publica (suele ser por sectores).");
  if (cat.guess) notes.push("Revisa la categoría: la elegimos sin pistas claras en el título.");
  return {
    title: ev.title,
    category: cat.category,
    status: notes.length ? "borrador" : "publicado",
    starts_at: startsAt,
    venue_name: venue?.name ?? ev.venueName,
    venue_address: venue?.address ?? ev.venueAddress,
    venue_zone: venue?.zone ?? null,
    lat: venue?.lat ?? null,
    lng: venue?.lng ?? null,
    price: ev.price,
    poster_url: ev.imageUrl,
    ticket_url: ev.url,
    source_url: ev.url,
    import_notes: notes.length ? notes.join("\n") : null,
  };
}

async function main() {
  console.log(`Importando de Superticket${DRY ? " (prueba, sin guardar)" : ""}…\n`);
  const orgId = DRY ? (await db.from("organizers").select("id").eq("name", ORG_NAME).maybeSingle()).data?.id ?? "" : await cartelera();
  const venues = await knownVenues(orgId);

  const [{ data: ignoredRows }, { data: existingRows }, { data: otherRows }] = await Promise.all([
    db.from("import_ignored").select("source_key").eq("source", SUPERTICKET),
    db.from("events").select("id, source_key, status, lat, price, category, import_notes").eq("source", SUPERTICKET),
    db
      .from("events")
      .select("title, starts_at")
      .is("source", null)
      .eq("status", "publicado")
      .gte("starts_at", new Date().toISOString()),
  ]);
  const ignored = new Set((ignoredRows ?? []).map((r) => r.source_key));
  const existing = new Map((existingRows ?? []).map((r) => [r.source_key as string, r]));
  const alreadyOnTilca = new Set((otherRows ?? []).map((e) => `${lpDay(e.starts_at!)}|${normalizeName(e.title)}`));

  const links = parseEventLinks(await fetchHtml(SUPERTICKET_HOME)).slice(0, MAX_PAGES);
  console.log(`${links.length} eventos en la portada de Superticket.\n`);

  const report = { publicados: [] as string[], borradores: [] as string[], actualizados: 0, otraCiudad: 0, noCultural: [] as string[], yaEnTilca: [] as string[], ignorados: 0, pasados: 0, errores: [] as string[] };
  const now = Date.now();

  // 1. Descargar y leer todas las páginas (una por segundo).
  const parsed: SourceEvent[] = [];
  for (const link of links) {
    await sleep(DELAY_MS);
    try {
      const ev = parseEventPage(await fetchHtml(link), link);
      if (ev) parsed.push(ev);
      else report.errores.push(`${link}: la página no trae datos de evento (schema.org)`);
    } catch (err) {
      report.errores.push(`${link}: ${(err as Error).message}`);
    }
  }

  // 2. Lugares que algún evento de esta corrida ubica en La Paz ("Cuentos y Melodías (La Paz)"
  //    en Espacio Kúu Inti): los otros eventos en ese lugar también son de La Paz.
  const laPazVenues = new Set(
    parsed.filter((ev) => ev.venueName && detectCity(ev) === "lapaz").map((ev) => normalizeName(ev.venueName!)),
  );

  // 3. Decidir evento por evento.
  for (const ev of parsed) {
    const city = detectCity(ev);
    if (city === "otra") {
      report.otraCiudad++;
      continue;
    }
    const cat = classify(ev.title, ev.venueName);
    if (!cat) {
      report.noCultural.push(ev.title);
      continue;
    }
    const venueKey = ev.venueName ? normalizeName(ev.venueName) : "";
    const venue = venueKey ? venues.get(venueKey) : undefined;
    const cityOk = city === "lapaz" || Boolean(venue?.confirmed) || laPazVenues.has(venueKey);

    for (const show of ev.shows) {
      if (Date.parse(show.startsAt) < now) {
        report.pasados++;
        continue;
      }
      const sourceKey = `${new URL(ev.url).pathname}#${show.key}`;
      if (ignored.has(sourceKey)) {
        report.ignorados++;
        continue;
      }
      const label = `${lpDay(show.startsAt)} ${ev.title} — ${ev.venueName ?? "¿lugar?"}`;
      const row = buildRow(ev, show.startsAt, venue, cityOk, cat);
      const prev = existing.get(sourceKey);

      if (prev) {
        // Ya importado: no pisamos lo que el equipo corrigió a mano (categoría, precio, ubicación, estado).
        // Solo completamos lo que faltaba y publicamos si ya no queda nada por revisar.
        if (prev.status === "publicado") continue;
        const patch: Partial<Row> = { poster_url: row.poster_url, ticket_url: row.ticket_url, source_url: row.source_url };
        if (prev.lat === null && row.lat !== null) Object.assign(patch, { lat: row.lat, lng: row.lng, venue_name: row.venue_name, venue_address: row.venue_address, venue_zone: row.venue_zone });
        if (prev.price === null && row.price !== null) patch.price = row.price;
        const stillMissing = String(prev.import_notes ?? "")
          .split("\n")
          .filter(Boolean)
          .filter((n) => !(n.startsWith("Ubica") && patch.lat != null) && !(n.startsWith("Confirma") && cityOk) && !(n.startsWith("Precio") && patch.price != null));
        patch.import_notes = stillMissing.length ? stillMissing.join("\n") : null;
        if (!stillMissing.length) patch.status = "publicado";
        if (!DRY) await db.from("events").update(patch).eq("id", prev.id);
        report.actualizados++;
        if (patch.status === "publicado") report.publicados.push(label);
        continue;
      }

      if (alreadyOnTilca.has(`${lpDay(show.startsAt)}|${normalizeName(ev.title)}`)) {
        report.yaEnTilca.push(label);
        continue;
      }

      if (!DRY) {
        const { error } = await db.from("events").insert({
          ...row,
          organizer_id: orgId,
          source: SUPERTICKET,
          source_key: sourceKey,
        });
        if (error) {
          report.errores.push(`${label}: ${error.message}`);
          continue;
        }
      }
      (row.status === "publicado" ? report.publicados : report.borradores).push(
        row.status === "publicado" ? label : `${label}\n      ${row.import_notes!.split("\n").join("\n      ")}`,
      );
    }
  }

  const list = (title: string, items: string[]) => items.length && console.log(`${title} (${items.length}):\n${items.map((i) => `  · ${i}`).join("\n")}\n`);
  list("Publicados en el mapa", report.publicados);
  list(`Borradores para revisar en el panel de "${ORG_NAME}"`, report.borradores);
  list("Ya estaban en TILCA (los publicó un organizador)", report.yaEnTilca);
  list("No son agenda cultural", report.noCultural);
  list("Errores", report.errores);
  console.log(
    `Además: ${report.actualizados} ya importados revisados, ${report.otraCiudad} de otras ciudades, ${report.pasados} funciones pasadas, ${report.ignorados} borrados antes por el equipo.`,
  );
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
