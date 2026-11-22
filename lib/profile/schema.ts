/**
 * Configuración del perfil público del organizador.
 *
 * Es solo datos: valores de listas cerradas, colores hex, textos con largo máximo y
 * links https. Nunca HTML ni CSS. `parseProfile` la limpia al guardar (servidor) y al
 * mostrar (por si alguien escribió la tabla directamente): lo que no cumple, se descarta.
 */

export const THEME_IDS = ["tilca", "telon", "neon", "aguayo", "galeria"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const FONT_IDS = ["archivo", "playfair", "bebas", "cormorant", "space", "fraunces"] as const;
export type FontId = (typeof FONT_IDS)[number];

export const INTRO_IDS = ["ninguna", "telon", "afiche", "luces", "confeti", "video"] as const;
export type IntroId = (typeof INTRO_IDS)[number];

export const BLOCK_TYPES = ["proximos", "pasados", "bio", "galeria", "video", "musica", "elenco", "prensa", "contacto"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const NETWORKS = ["instagram", "facebook", "tiktok", "youtube", "x", "web"] as const;
export type Network = (typeof NETWORKS)[number];

export interface Media {
  kind: "image" | "video";
  url: string;
}

export interface Photo {
  url: string;
  caption: string;
}
export interface Person {
  name: string;
  role: string;
  photo: string | null;
}
export interface PressItem {
  quote: string;
  outlet: string;
  url: string | null;
}
export interface SocialLink {
  network: Network;
  url: string;
}

export type Block =
  | { type: "proximos"; visible: boolean }
  | { type: "pasados"; visible: boolean }
  | { type: "bio"; visible: boolean; text: string }
  | { type: "galeria"; visible: boolean; photos: Photo[] }
  | { type: "video"; visible: boolean; youtubeId: string | null; title: string }
  | { type: "musica"; visible: boolean; provider: "spotify" | "youtube"; embedId: string | null }
  | { type: "elenco"; visible: boolean; people: Person[] }
  | { type: "prensa"; visible: boolean; items: PressItem[] }
  | { type: "contacto"; visible: boolean; email: string; whatsapp: string; links: SocialLink[] };

export interface ProfileConfig {
  version: 1;
  theme: ThemeId;
  /** null = el acento del tema. */
  accent: string | null;
  /** null = la tipografía del tema. */
  font: FontId | null;
  tagline: string;
  avatar: string | null;
  cover: Media | null;
  intro: IntroId;
  introVideo: string | null;
  blocks: Block[];
}

export const LIMITS = { tagline: 120, bio: 2000, name: 60, role: 60, quote: 400, outlet: 60, caption: 120, photos: 12, people: 24, press: 12, links: 8 };

export const BLOCK_LABELS: Record<BlockType, string> = {
  proximos: "Próximos eventos",
  pasados: "Eventos pasados",
  bio: "Bio",
  galeria: "Galería de fotos",
  video: "Video",
  musica: "Música",
  elenco: "Integrantes o elenco",
  prensa: "Prensa y reseñas",
  contacto: "Contacto y redes",
};

export function emptyBlock(type: BlockType, visible = false): Block {
  switch (type) {
    case "proximos":
    case "pasados":
      return { type, visible };
    case "bio":
      return { type, visible, text: "" };
    case "galeria":
      return { type, visible, photos: [] };
    case "video":
      return { type, visible, youtubeId: null, title: "" };
    case "musica":
      return { type, visible, provider: "spotify", embedId: null };
    case "elenco":
      return { type, visible, people: [] };
    case "prensa":
      return { type, visible, items: [] };
    case "contacto":
      return { type, visible, email: "", whatsapp: "", links: [] };
  }
}

/** Perfil sin personalizar: colores de TILCA, eventos arriba y el resto listo para llenar. */
export function defaultProfile(): ProfileConfig {
  return {
    version: 1,
    theme: "tilca",
    accent: null,
    font: null,
    tagline: "",
    avatar: null,
    cover: null,
    intro: "ninguna",
    introVideo: null,
    blocks: [
      emptyBlock("proximos", true),
      emptyBlock("bio", true),
      emptyBlock("pasados", true),
      emptyBlock("galeria", true),
      emptyBlock("video", true),
      emptyBlock("musica", true),
      emptyBlock("elenco", true),
      emptyBlock("prensa", true),
      emptyBlock("contacto", true),
    ],
  };
}

// --- Validación ----------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;

function text(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "";
}

function pick<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

function httpsUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 500) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Archivos del perfil: solo los que se subieron al bucket "perfiles" de este proyecto,
 * o las imágenes de ejemplo que vienen con la app (/ejemplos/...).
 */
export function mediaUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 500) return null;
  if (/^\/ejemplos\/[a-z0-9-]+\.(svg|png|jpg|webp|gif|mp4|webm)$/.test(v)) return v;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) return null;
  const prefix = `${base}/storage/v1/object/public/perfiles/`;
  return v.startsWith(prefix) && /^[A-Za-z0-9/._-]+$/.test(v.slice(prefix.length)) && !v.includes("..") ? v : null;
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm)$/i.test(url);
}

/** Link o id de YouTube -> id de 11 caracteres. */
export function youtubeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Link de Spotify -> "album/ID", "playlist/ID", "track/ID", "artist/ID" o "episode/ID". */
export function spotifyId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^(album|playlist|track|artist|episode|show)\/[A-Za-z0-9]{22}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname !== "open.spotify.com") return null;
    const m = u.pathname.match(/(?:\/intl-[a-z-]+)?\/(album|playlist|track|artist|episode|show)\/([A-Za-z0-9]{22})/);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

function bool(v: unknown) {
  return v === true;
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

function parseBlock(raw: Record<string, unknown>): Block | null {
  const type = pick(raw.type, BLOCK_TYPES, "bio");
  if (raw.type !== type) return null;
  const visible = bool(raw.visible);
  switch (type) {
    case "proximos":
    case "pasados":
      return { type, visible };
    case "bio":
      return { type, visible, text: text(raw.text, LIMITS.bio) };
    case "galeria":
      return {
        type,
        visible,
        photos: arr(raw.photos)
          .map((p) => ({ url: mediaUrl(p.url), caption: text(p.caption, LIMITS.caption) }))
          .filter((p): p is Photo => !!p.url && !isVideoUrl(p.url))
          .slice(0, LIMITS.photos),
      };
    case "video":
      return { type, visible, youtubeId: youtubeId(raw.youtubeId), title: text(raw.title, LIMITS.caption) };
    case "musica": {
      const provider = pick(raw.provider, ["spotify", "youtube"] as const, "spotify");
      return { type, visible, provider, embedId: provider === "spotify" ? spotifyId(raw.embedId) : youtubeId(raw.embedId) };
    }
    case "elenco":
      return {
        type,
        visible,
        people: arr(raw.people)
          .map((p) => {
            const photo = mediaUrl(p.photo);
            return { name: text(p.name, LIMITS.name), role: text(p.role, LIMITS.role), photo: photo && !isVideoUrl(photo) ? photo : null };
          })
          .filter((p) => p.name)
          .slice(0, LIMITS.people),
      };
    case "prensa":
      return {
        type,
        visible,
        items: arr(raw.items)
          .map((p) => ({ quote: text(p.quote, LIMITS.quote), outlet: text(p.outlet, LIMITS.outlet), url: httpsUrl(p.url) }))
          .filter((p) => p.quote)
          .slice(0, LIMITS.press),
      };
    case "contacto": {
      const email = text(raw.email, 120);
      const whatsapp = text(raw.whatsapp, 20).replace(/[^\d+]/g, "");
      return {
        type,
        visible,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
        whatsapp: /^\+?\d{7,15}$/.test(whatsapp) ? whatsapp : "",
        links: arr(raw.links)
          .map((l) => ({ network: pick(l.network, NETWORKS, "web"), url: httpsUrl(l.url) }))
          .filter((l): l is SocialLink => !!l.url)
          .slice(0, LIMITS.links),
      };
    }
  }
}

/** Limpia una configuración cualquiera. Siempre devuelve un perfil válido. */
export function parseProfile(raw: unknown): ProfileConfig {
  const base = defaultProfile();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  // Un bloque de cada tipo, en el orden guardado; los que falten se agregan ocultos al final.
  const seen = new Set<BlockType>();
  const blocks: Block[] = [];
  for (const b of arr(r.blocks)) {
    const block = parseBlock(b);
    if (block && !seen.has(block.type)) {
      seen.add(block.type);
      blocks.push(block);
    }
  }
  for (const t of BLOCK_TYPES) if (!seen.has(t)) blocks.push(emptyBlock(t, false));

  const coverUrl = r.cover && typeof r.cover === "object" ? mediaUrl((r.cover as Record<string, unknown>).url) : null;
  const avatar = mediaUrl(r.avatar);
  const introVideo = mediaUrl(r.introVideo);
  const intro = pick(r.intro, INTRO_IDS, "ninguna");

  return {
    version: 1,
    theme: pick(r.theme, THEME_IDS, base.theme),
    accent: typeof r.accent === "string" && HEX.test(r.accent) ? r.accent.toLowerCase() : null,
    font: r.font === null ? null : (FONT_IDS as readonly string[]).includes(r.font as string) ? (r.font as FontId) : null,
    tagline: text(r.tagline, LIMITS.tagline),
    avatar: avatar && !isVideoUrl(avatar) ? avatar : null,
    cover: coverUrl ? { kind: isVideoUrl(coverUrl) ? "video" : "image", url: coverUrl } : null,
    intro: intro === "video" && !(introVideo && isVideoUrl(introVideo)) ? "ninguna" : intro,
    introVideo: introVideo && isVideoUrl(introVideo) ? introVideo : null,
    blocks,
  };
}
