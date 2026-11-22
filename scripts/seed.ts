/**
 * Datos de ejemplo de TILCA. Todo queda marcado con is_sample = true.
 *
 *   npm run seed
 *
 * Usa SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY) de .env.local.
 * Se puede correr varias veces: borra los datos de ejemplo anteriores y los vuelve a crear
 * con fechas relativas a hoy (próximas 3 semanas).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lpMidnight } from "../lib/time-filters";
import { venueByName } from "../lib/venues";
import { SAMPLE_PROFILES } from "./seed-profiles";

// Se crea al correr el seed (no al importar el archivo: también lo usa "Restablecer datos de ejemplo").
let db: SupabaseClient;

export const DEMO_EMAIL = "demo@tilca.bo";
export const DEMO_PASSWORD = "tilca-demo-2026";

// Generador pseudoaleatorio con semilla: los datos salen iguales cada vez.
const SEED = 20261120;
let seed = SEED;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

let NOW = new Date();
/** Día `d` desde hoy (hora de La Paz) a las hh:mm. */
function at(d: number, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(lpMidnight(NOW, d).getTime() + (h * 60 + m) * 60_000);
}

type Cat = "teatro" | "musica" | "danza" | "standup" | "arte";
interface SeedEvent {
  key: string;
  organizer: string;
  title: string;
  category: Cat;
  subcategory?: string;
  venue?: string;
  day?: number;
  time?: string;
  endDay?: number;
  duration?: number;
  price?: number;
  presale?: { price: number; untilDay: number };
  capacity?: number;
  ticketsSold?: number;
  description?: string;
  ticket?: boolean;
  saves?: number;
  status?: "borrador" | "publicado";
  publishedDaysAgo?: number;
}

const TICKETERA = "https://superticket.bo";

/**
 * Venta con código TILCA de los eventos de pago: el código de descuento que cada
 * organizador creó en su ticketera, dónde vende y cuántas ventas espera de TILCA.
 * Los eventos gratis no llevan código.
 */
const SALES: Record<string, { code: string; discount?: [number, "bs" | "pct"]; channels: string[]; expected: number }> = {
  casa: { code: "TILCA10", discount: [10, "pct"], channels: ["ticketera", "puerta"], expected: 40 },
  monologos: { code: "TILCA-RISAS", discount: [5, "bs"], channels: ["ticketera", "qr"], expected: 20 },
  tren: { code: "TILCA-TREN", channels: ["ticketera"], expected: 10 },
  jazz: { code: "TILCA-JAZZ", discount: [5, "bs"], channels: ["ticketera", "puerta"], expected: 25 },
  morenada: { code: "TILCA-DANZA", channels: ["qr", "puerta"], expected: 30 },
  cine: { code: "TILCA-CINE", discount: [3, "bs"], channels: ["ticketera"], expected: 15 },
  cumbia: { code: "TILCA-CUMBIA", channels: ["ticketera", "puerta"], expected: 40 },
  hamlet: { code: "TILCA-HAMLET", discount: [10, "pct"], channels: ["ticketera"], expected: 20 },
  charango: { code: "TILCA-CHARANGO", channels: ["qr"], expected: 15 },
  butoh: { code: "TILCA-BUTOH", channels: ["puerta"], expected: 10 },
  terapia: { code: "TILCA-TERAPIA", discount: [5, "bs"], channels: ["ticketera", "qr"], expected: 25 },
  beethoven: { code: "TILCA-SINFONICA", discount: [10, "pct"], channels: ["ticketera"], expected: 50 },
  zorro: { code: "TILCA-ZORRO", channels: ["ticketera", "puerta"], expected: 20 },
  electro: { code: "TILCA10", discount: [10, "pct"], channels: ["ticketera", "qr", "puerta"], expected: 35 },
};

const EVENTS: SeedEvent[] = [
  // ---- Teatro de Altura (cuenta demo) ----
  {
    key: "casa",
    organizer: "Teatro de Altura",
    title: "La casa de los espejos",
    category: "teatro",
    subcategory: "comedia",
    venue: "Teatro Municipal Alberto Saavedra Pérez",
    day: 7,
    time: "20:00",
    duration: 75,
    price: 50,
    presale: { price: 40, untilDay: 4 },
    capacity: 220,
    ticketsSold: 96,
    ticket: true,
    saves: 34,
    publishedDaysAgo: 13,
    description:
      "Una familia paceña hereda una casona en San Pedro llena de espejos que muestran lo que cada uno calla. Comedia costumbrista para quienes disfrutan reírse de sí mismos.",
  },
  {
    key: "monologos",
    organizer: "Teatro de Altura",
    title: "Monólogos de medianoche",
    category: "standup",
    venue: "Equinoccio",
    day: 22,
    time: "23:00",
    duration: 90,
    price: 40,
    capacity: 150,
    ticketsSold: 27,
    ticket: true,
    saves: 12,
    publishedDaysAgo: 10,
    description: "Cinco comediantes de la compañía prueban material nuevo cuando la ciudad ya duerme. Humor para mayores de 18.",
  },
  {
    key: "tren",
    organizer: "Teatro de Altura",
    title: "El último tren",
    category: "teatro",
    subcategory: "drama",
    venue: "Teatro Municipal Alberto Saavedra Pérez",
    day: -9,
    time: "20:00",
    duration: 80,
    price: 45,
    capacity: 220,
    ticketsSold: 180,
    ticket: true,
    saves: 21,
    publishedDaysAgo: 29,
    description: "La última noche de la estación de Viacha, contada por quienes se quedaron.",
  },
  {
    key: "taller",
    organizer: "Teatro de Altura",
    title: "Taller de improvisación",
    category: "teatro",
    status: "borrador",
    description: "Cuatro sesiones para perderle el miedo al escenario.",
  },

  // ---- Otros organizadores de ejemplo ----
  {
    key: "jazz",
    organizer: "Cuarteto Altiplano",
    title: "Noche de jazz con Cuarteto Altiplano",
    category: "musica",
    subcategory: "jazz",
    venue: "Thelonious Jazz Bar",
    day: 7,
    time: "22:00",
    duration: 120,
    price: 40,
    capacity: 80,
    ticket: true,
    saves: 27,
    description: "Standards y composiciones propias con charango eléctrico. Dos sets, con pausa para pedir otra.",
  },
  {
    key: "morenada",
    organizer: "Colectivo Danza Viva",
    title: "Morenada contemporánea",
    category: "danza",
    venue: "Espacio Simón I. Patiño",
    day: 8,
    time: "19:30",
    duration: 60,
    price: 35,
    capacity: 120,
    ticket: true,
    saves: 18,
    description: "Doce bailarines desarman la morenada y la vuelven a armar con música electrónica en vivo.",
  },
  {
    key: "micro",
    organizer: "Micro Abierto LPZ",
    title: "Micro abierto de stand up",
    category: "standup",
    venue: "Equinoccio",
    day: 8,
    time: "21:00",
    duration: 100,
    price: 0,
    saves: 9,
    description: "Cualquiera puede subir: cinco minutos por persona. Inscripción en la puerta desde las 20:30.",
  },
  {
    key: "micro-pasado",
    organizer: "Micro Abierto LPZ",
    title: "Micro abierto: noche de aniversario",
    category: "standup",
    venue: "Equinoccio",
    day: -6,
    time: "21:00",
    duration: 120,
    price: 0,
    saves: 14,
    publishedDaysAgo: 20,
    description: "Dos años de micrófono abierto, con invitados sorpresa.",
  },
  {
    key: "cholets",
    organizer: "Museo Nacional de Arte (ejemplo)",
    title: "Cholets: arquitectura de lo nuestro",
    category: "arte",
    subcategory: "exposición",
    venue: "Museo Nacional de Arte",
    day: -5,
    time: "10:00",
    endDay: 23,
    price: 0,
    saves: 40,
    description: "Fotografías, maquetas y planos de los cholets de El Alto, la arquitectura más original de los Andes.",
  },
  {
    key: "cine",
    organizer: "Cineclub Illimani",
    title: "Ciclo de cine boliviano",
    category: "arte",
    subcategory: "cine",
    venue: "Cinemateca Boliviana",
    day: 0,
    time: "19:30",
    duration: 110,
    price: 20,
    capacity: 160,
    ticket: true,
    saves: 15,
    description: "Una película boliviana por noche, con charla con el equipo al final.",
  },
  {
    key: "cumbia",
    organizer: "Sonido Chicha",
    title: "Cumbia en el Prado",
    category: "musica",
    subcategory: "cumbia",
    venue: "Teatro al Aire Libre Jaime Laredo",
    day: 1,
    time: "18:00",
    duration: 180,
    price: 30,
    capacity: 1500,
    ticket: true,
    saves: 33,
    description: "Tres bandas de cumbia paceña y una pista grande para bailar.",
  },
  {
    key: "poesia",
    organizer: "Colectivo Palabra Suelta",
    title: "Poesía en Sopocachi",
    category: "arte",
    subcategory: "lectura",
    venue: "Centro Cultural de España en La Paz",
    day: 0,
    time: "19:00",
    duration: 90,
    price: 0,
    saves: 7,
    description: "Lectura abierta de poesía joven paceña. Trae un poema o ven a escuchar.",
  },
  {
    key: "hamlet",
    organizer: "Teatro Jach'a",
    title: "Hamlet en aymara",
    category: "teatro",
    subcategory: "clásico",
    venue: "Casa de la Cultura",
    day: 14,
    time: "20:00",
    duration: 110,
    price: 30,
    capacity: 200,
    ticket: true,
    saves: 25,
    description: "Shakespeare en aymara con sobretítulos en castellano. Una versión que viaja del castillo al altiplano.",
  },
  {
    key: "charango",
    organizer: "Cuerdas del Ande",
    title: "Recital de charango",
    category: "musica",
    subcategory: "folclore",
    venue: "Museo Nacional de Etnografía y Folklore",
    day: 1,
    time: "19:00",
    duration: 70,
    price: 25,
    capacity: 90,
    ticket: true,
    saves: 11,
    description: "Repertorio tradicional y nuevo para charango solista, en el patio del museo.",
  },
  {
    key: "butoh",
    organizer: "Colectivo Danza Viva",
    title: "Butoh en la altura",
    category: "danza",
    venue: "Goethe-Institut La Paz",
    day: 15,
    time: "19:30",
    duration: 55,
    price: 20,
    capacity: 70,
    ticket: true,
    saves: 6,
    description: "Danza butoh y respiración a 3600 metros. Una pieza lenta, para ver de cerca.",
  },
  {
    key: "terapia",
    organizer: "Risa Paceña",
    title: "Paceños en terapia",
    category: "standup",
    venue: "Alianza Francesa de La Paz",
    day: 6,
    time: "20:30",
    duration: 75,
    price: 35,
    capacity: 140,
    ticket: true,
    saves: 19,
    description: "Un show sobre el tráfico, los minibuses y la familia. Para reírse de lo que nos pasa todos los días.",
  },
  {
    key: "foto",
    organizer: "Fotógrafos de La Paz",
    title: "Altura: fotografía paceña",
    category: "arte",
    subcategory: "exposición",
    venue: "Espacio Simón I. Patiño",
    day: -2,
    time: "10:00",
    endDay: 18,
    price: 0,
    saves: 14,
    description: "Treinta fotógrafos retratan la ciudad desde sus techos, sus calles y sus teleféricos.",
  },
  {
    key: "beethoven",
    organizer: "Orquesta Sinfónica (ejemplo)",
    title: "Noches de Beethoven",
    category: "musica",
    subcategory: "clásica",
    venue: "Teatro Municipal Alberto Saavedra Pérez",
    day: 13,
    time: "20:00",
    duration: 100,
    price: 60,
    presale: { price: 45, untilDay: 9 },
    capacity: 220,
    ticket: true,
    saves: 29,
    description: "La Quinta y la Séptima sinfonía en una sola noche.",
  },
  {
    key: "zorro",
    organizer: "Teatro Jach'a",
    title: "El zorro y el cóndor",
    category: "teatro",
    subcategory: "infantil",
    venue: "Casa de la Cultura",
    day: 2,
    time: "16:00",
    duration: 50,
    price: 20,
    capacity: 200,
    ticket: true,
    saves: 10,
    description: "Títeres y música en vivo para niñas y niños desde los 4 años.",
  },
  {
    key: "electro",
    organizer: "Sonido Chicha",
    title: "Electrónica andina",
    category: "musica",
    subcategory: "electrónica",
    venue: "Equinoccio",
    day: 0,
    time: "23:00",
    duration: 240,
    price: 40,
    capacity: 300,
    ticket: true,
    saves: 22,
    description: "Sikus, quenas y sintetizadores hasta la madrugada.",
  },
];

/** Métricas para los eventos de Teatro de Altura, parecidas a las de los mockups. */
const METRICS: Record<
  string,
  {
    views: number;
    viewsLast7: number;
    clicks: number;
    clicksLast7: number;
    daysBack: [from: number, to: number];
    tickets: number[] | { total: number };
    channels: Record<string, number>;
  }
> = {
  casa: {
    views: 820,
    viewsLast7: 342,
    clicks: 124,
    clicksLast7: 51,
    daysBack: [13, 0],
    tickets: [0, 1, 0, 2, 1, 3, 2, 1, 4, 2, 3, 5, 2, 2], // 28, pico de 5
    channels: { whatsapp: 12, mapa: 8, amigo: 5, busqueda: 3 },
  },
  monologos: {
    views: 310,
    viewsLast7: 190,
    clicks: 48,
    clicksLast7: 30,
    daysBack: [10, 0],
    tickets: { total: 11 },
    channels: { mapa: 5, whatsapp: 3, amigo: 2, busqueda: 1 },
  },
  tren: {
    views: 110,
    viewsLast7: 0,
    clicks: 14,
    clicksLast7: 0,
    daysBack: [29, 9],
    tickets: { total: 3 },
    channels: { mapa: 2, amigo: 1 },
  },
};

/** Momento al azar del día `d` (negativo = hace d días), entre las 9:00 y las 23:00, sin pasar de ahora. */
function randomMoment(d: number) {
  const t = new Date(lpMidnight(NOW, d).getTime() + (9 + rand() * 14) * 3600_000);
  return t > NOW ? new Date(NOW.getTime() - rand() * 3600_000) : t;
}

function spread(total: number, from: number, to: number) {
  const out: Date[] = [];
  for (let i = 0; i < total; i++) out.push(randomMoment(-Math.round(to + rand() * (from - to))));
  return out;
}

function weightedChannel() {
  const r = rand();
  return r < 0.4 ? "mapa" : r < 0.7 ? "whatsapp" : r < 0.85 ? "amigo" : "busqueda";
}

async function insertBatches(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function seedDemoData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local");
  db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // Mismos datos en cada corrida, con fechas relativas a hoy.
  seed = SEED;
  NOW = new Date();

  console.log("Borrando datos de ejemplo anteriores…");
  {
    const { error } = await db.from("organizers").delete().eq("is_sample", true);
    if (error) throw error;
  }
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const old = users?.users.find((u) => u.email === DEMO_EMAIL);
  if (old) await db.auth.admin.deleteUser(old.id);

  console.log("Creando la cuenta demo de Teatro de Altura…");
  const { data: created, error: userErr } = await db.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { role: "organizador", org_name: "Teatro de Altura" },
  });
  if (userErr || !created.user) throw userErr ?? new Error("No se creó el usuario demo");
  // El trigger ya creó el organizador; lo marcamos como ejemplo.
  const demoOrgUpdate: Record<string, unknown> = { is_sample: true };
  // Sin cuenta Stellar: `npm run migrate:stellar` (o el primer depósito) crea una real en Testnet.
  const { data: demoOrg, error: orgErr } = await db
    .from("organizers")
    .update(demoOrgUpdate)
    .eq("owner_id", created.user.id)
    .select("id, name")
    .single();
  if (orgErr) throw orgErr;

  const orgIds = new Map<string, string>([[demoOrg.name, demoOrg.id]]);
  for (const name of new Set(EVENTS.map((e) => e.organizer))) {
    if (orgIds.has(name)) continue;
    const orgInsert: Record<string, unknown> = { name, is_sample: true };
    const { data, error } = await db
      .from("organizers")
      .insert(orgInsert)
      .select("id")
      .single();
    if (error) throw error;
    orgIds.set(name, data.id);
  }

  console.log(`Creando ${EVENTS.length} eventos…`);
  const eventIds = new Map<string, string>();
  for (const e of EVENTS) {
    const v = e.venue ? venueByName(e.venue) : null;
    const status = e.status ?? "publicado";
    const startsAt = e.day !== undefined ? at(e.day, e.time ?? "20:00") : null;
    const eventInsert: Record<string, unknown> = {
      organizer_id: orgIds.get(e.organizer),
      title: e.title,
      category: e.category,
      subcategory: e.subcategory ?? null,
      status,
      starts_at: startsAt?.toISOString() ?? null,
      ends_at: e.endDay !== undefined ? at(e.endDay, "19:00").toISOString() : null,
      duration_min: e.duration ?? null,
      venue_name: v?.name ?? null,
      venue_address: v?.address ?? null,
      venue_zone: v?.zone ?? null,
      lat: v?.lat ?? null,
      lng: v?.lng ?? null,
      price: e.price ?? null,
      presale_price: e.presale?.price ?? null,
      presale_until: e.presale ? at(e.presale.untilDay, "23:59").toISOString() : null,
      capacity: e.capacity ?? null,
      tickets_sold: e.ticketsSold ?? 0,
      description: e.description ?? null,
      ticket_url: e.ticket && (SALES[e.key]?.channels.includes("ticketera") ?? true) ? TICKETERA : null,
      sample_saves: e.saves ?? 0,
      is_sample: true,
      published_at:
        status === "publicado"
          ? at(-(e.publishedDaysAgo ?? 20), "10:00").toISOString()
          : null,
    };

    const sale = (e.price ?? 0) > 0 ? SALES[e.key] : undefined;
    if (sale) {
      eventInsert.discount_code = sale.code;
      eventInsert.discount_amount = sale.discount?.[0] ?? null;
      eventInsert.discount_unit = sale.discount?.[1] ?? null;
      eventInsert.sales_channels = sale.channels;
      eventInsert.expected_sales = sale.expected;
      // Depósito sugerido (ventas esperadas × precio × 5%). Sin transacciones inventadas:
      // queda pendiente y el organizador lo deposita de verdad en Testnet desde el panel.
      eventInsert.promo_budget_bs = Math.round(sale.expected * (e.price ?? 0) * 5) / 100;
      eventInsert.escrow_status = status === "publicado" ? "deposito_pendiente" : "sin_escrow";
    }

    const { data, error } = await db
      .from("events")
      .insert(eventInsert)
      .select("id")
      .single();
    if (error) throw new Error(`${e.title}: ${error.message}`);
    eventIds.set(e.key, data.id);
  }

  console.log("Creando perfiles públicos de ejemplo…");
  for (const [name, profile] of Object.entries(SAMPLE_PROFILES)) {
    const orgId = orgIds.get(name);
    if (!orgId) continue;
    // Si otro organizador sin dueño ni eventos (restos de seeds anteriores) tiene el slug, se lo cede.
    const { data: holder } = await db.from("organizers").select("id, owner_id").eq("slug", profile.slug).neq("id", orgId).maybeSingle();
    if (holder) {
      const { count } = await db.from("events").select("id", { count: "exact", head: true }).eq("organizer_id", holder.id);
      if (holder.owner_id || count) {
        console.log(`  ${profile.slug} ya lo usa otro organizador; ${name} queda con su slug automático.`);
      } else {
        await db.from("organizers").update({ slug: `${profile.slug}-anterior-${holder.id.slice(0, 6)}` }).eq("id", holder.id);
      }
    }
    await db.from("organizers").update({ slug: profile.slug }).eq("id", orgId);
    for (const table of ["organizer_profiles", "organizer_profile_drafts"]) {
      const { error } = await db.from(table).upsert({ organizer_id: orgId, config: profile.config });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`  /o/${profile.slug}`);
  }

  console.log("Creando vistas, clics y ventas confirmadas…");
  for (const [key, m] of Object.entries(METRICS)) {
    const eventId = eventIds.get(key)!;
    const [from, to] = m.daysBack;

    const recentFrom = Math.min(6, from);
    const viewDates = [
      ...spread(m.viewsLast7, recentFrom, to),
      ...spread(m.views - m.viewsLast7, from, Math.max(to, 7)),
    ];
    await insertBatches(
      "views",
      viewDates.map((d) => ({ event_id: eventId, anon_id: "ejemplo", channel: weightedChannel(), is_sample: true, created_at: d.toISOString() })),
    );

    // Días con ventas confirmadas: por día (casa) o repartidas.
    const ticketDays: number[] = [];
    if (Array.isArray(m.tickets)) {
      m.tickets.forEach((n, i) => {
        for (let k = 0; k < n; k++) ticketDays.push(from - i);
      });
    } else {
      for (let i = 0; i < m.tickets.total; i++) ticketDays.push(Math.round(to + rand() * (from - to)));
    }

    // Ventas confirmadas: una confirmación por día con ventas (la mayoría por ticketera,
    // alguna marcada en puerta si el evento vende ahí).
    const byDay = new Map<number, number>();
    for (const d of ticketDays) byDay.set(d, (byDay.get(d) ?? 0) + 1);
    const atDoor = SALES[key]?.channels.includes("puerta");
    const saleRows: Record<string, unknown>[] = [];
    for (const [d, n] of byDay) {
      const door = atDoor && n > 1 ? 1 : 0;
      const when = randomMoment(-d).toISOString();
      saleRows.push({ event_id: eventId, source: "ticketera", quantity: n - door, is_sample: true, created_at: when });
      if (door) saleRows.push({ event_id: eventId, source: "puerta", quantity: door, is_sample: true, created_at: when });
    }
    await insertBatches("sales_confirmations", saleRows);

    // Clics en "Comprar" (sin código: el código ahora es uno por evento), respetando cuántos fueron en los últimos 7 días.
    const clickRows: Record<string, unknown>[] = [];
    const extraRecent = m.clicksLast7;
    const extraOld = Math.max(0, m.clicks - extraRecent);
    const pool: string[] = Object.entries(m.channels).flatMap(([ch, n]) => Array(n).fill(ch));
    for (const d of [...spread(extraRecent, recentFrom, to), ...spread(extraOld, from, Math.max(to, 7))]) {
      clickRows.push({
        event_id: eventId,
        anon_id: "ejemplo",
        channel: pool.length && rand() < 0.5 ? pool[Math.floor(rand() * pool.length)] : weightedChannel(),
        created_at: d.toISOString(),
        is_sample: true,
      });
    }
    await insertBatches("clicks", clickRows);
    console.log(`  ${key}: ${viewDates.length} vistas, ${clickRows.length} clics, ${ticketDays.length} ventas confirmadas`);
  }

  console.log("\nListo. Cuenta demo del organizador:");
  console.log(`  correo:     ${DEMO_EMAIL}`);
  console.log(`  contraseña: ${DEMO_PASSWORD}`);
}

// `npm run seed`: se ejecuta solo cuando se corre este archivo directamente.
if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  seedDemoData().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

