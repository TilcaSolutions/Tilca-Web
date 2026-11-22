import type { FontId, ProfileConfig, ThemeId } from "./schema";

export interface Theme {
  id: ThemeId;
  label: string;
  description: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  font: FontId;
  /** Peso de los títulos (Galería usa títulos finos). */
  titleWeight: number;
  card: "flat" | "elevated" | "outline" | "framed";
  pattern: "aguayo" | null;
  /** Fondo oscuro: la portada sin imagen usa un degradado más profundo. */
  dark: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
  tilca: {
    id: "tilca",
    label: "TILCA",
    description: "El diseño por defecto, limpio y con los colores de TILCA.",
    bg: "#f4f5f7",
    surface: "#ffffff",
    text: "#17191e",
    muted: "#4b505a",
    line: "#e4e6ea",
    accent: "#0e4d33",
    font: "archivo",
    titleWeight: 800,
    card: "elevated",
    pattern: null,
    dark: false,
  },
  telon: {
    id: "telon",
    label: "Telón",
    description: "Rojo profundo y dorado, títulos con serifa. Para teatro.",
    bg: "#3d0a12",
    surface: "#521019",
    text: "#fbf1dc",
    muted: "#e3cda3",
    line: "#6e2029",
    accent: "#e0b44c",
    font: "playfair",
    titleWeight: 700,
    card: "framed",
    pattern: null,
    dark: true,
  },
  neon: {
    id: "neon",
    label: "Neón",
    description: "Fondo oscuro y acento fucsia. Para stand up y música.",
    bg: "#0b0b12",
    surface: "#15151f",
    text: "#f4f4f8",
    muted: "#a9a9bd",
    line: "#2a2a3a",
    accent: "#ff2e93",
    font: "bebas",
    titleWeight: 400,
    card: "outline",
    pattern: null,
    dark: true,
  },
  aguayo: {
    id: "aguayo",
    label: "Aguayo",
    description: "Colores andinos vivos con un patrón geométrico. Para folklore y danza.",
    bg: "#fff6e6",
    surface: "#ffffff",
    text: "#2b1a12",
    muted: "#6b4a36",
    line: "#f0d9b5",
    accent: "#c8102e",
    font: "fraunces",
    titleWeight: 800,
    card: "framed",
    pattern: "aguayo",
    dark: false,
  },
  galeria: {
    id: "galeria",
    label: "Galería",
    description: "Blanco, mucho aire y títulos finos. Para exposiciones.",
    bg: "#ffffff",
    surface: "#ffffff",
    text: "#111111",
    muted: "#666666",
    line: "#e8e8e8",
    accent: "#111111",
    font: "cormorant",
    titleWeight: 300,
    card: "flat",
    pattern: null,
    dark: false,
  },
};

export const FONTS: Record<FontId, { label: string; cssVar: string }> = {
  archivo: { label: "Archivo", cssVar: "var(--font-archivo)" },
  playfair: { label: "Playfair Display", cssVar: "var(--pf-playfair)" },
  bebas: { label: "Bebas Neue", cssVar: "var(--pf-bebas)" },
  cormorant: { label: "Cormorant Garamond", cssVar: "var(--pf-cormorant)" },
  space: { label: "Space Grotesk", cssVar: "var(--pf-space)" },
  fraunces: { label: "Fraunces", cssVar: "var(--pf-fraunces)" },
};

// --- Contraste (WCAG 2.1) ------------------------------------------------------

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Texto que va encima del color de acento (botones): negro o blanco, el que se lea mejor. */
export function inkOn(color: string) {
  return contrast(color, "#ffffff") >= contrast(color, "#111111") ? "#ffffff" : "#111111";
}

/** Colores finales del perfil: el tema con el acento y la tipografía que eligió el organizador. */
export function resolveTheme(config: Pick<ProfileConfig, "theme" | "accent" | "font">) {
  const t = THEMES[config.theme];
  const accent = config.accent ?? t.accent;
  const font = config.font ?? t.font;
  return {
    ...t,
    accent,
    accentInk: inkOn(accent),
    font,
    fontFamily: FONTS[font].cssVar,
    titleWeight: config.font && config.font !== t.font ? (font === "cormorant" ? 400 : font === "bebas" ? 400 : 700) : t.titleWeight,
  };
}
export type ResolvedTheme = ReturnType<typeof resolveTheme>;

/** Avisos de contraste para el editor (vacío = todo se lee bien). */
export function contrastWarnings(theme: ResolvedTheme): string[] {
  const out: string[] = [];
  const onBg = contrast(theme.accent, theme.bg);
  if (onBg < 3) {
    out.push(`El color de acento casi no se distingue del fondo (contraste ${onBg.toFixed(1)}:1; mínimo 3:1). Los títulos y links pueden no leerse.`);
  }
  const onAccent = contrast(theme.accentInk, theme.accent);
  if (onAccent < 4.5) {
    out.push(`El texto de los botones sobre el acento se lee mal (contraste ${onAccent.toFixed(1)}:1; mínimo 4.5:1).`);
  }
  return out;
}
