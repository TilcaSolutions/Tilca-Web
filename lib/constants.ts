export type Category = "teatro" | "musica" | "danza" | "standup" | "arte";
export type Channel = "whatsapp" | "mapa" | "amigo" | "busqueda";

export const CATEGORIES: { id: Category; label: string; color: string; ink: string }[] = [
  { id: "teatro", label: "Teatro", color: "#C8102E", ink: "#FFFFFF" },
  { id: "musica", label: "Música", color: "#F2B705", ink: "#17191E" },
  { id: "danza", label: "Danza", color: "#1F7A4D", ink: "#FFFFFF" },
  { id: "standup", label: "Stand up", color: "#1E7FC2", ink: "#FFFFFF" },
  { id: "arte", label: "Arte", color: "#7A3FA0", ink: "#FFFFFF" },
];

export function categoryInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: "whatsapp", label: "Cartelera de WhatsApp" },
  { id: "mapa", label: "Mapa de TILCA" },
  { id: "amigo", label: "Link de un amigo" },
  { id: "busqueda", label: "Búsqueda" },
];

export function parseChannel(value: unknown): Channel | null {
  return typeof value === "string" && CHANNELS.some((c) => c.id === value) ? (value as Channel) : null;
}

/** Lo que paga el organizador por cada entrada de público nuevo. */
export const PRICE_PER_NEW_ATTENDEE = 5;

export const TIME_ZONE = "America/La_Paz";

export const ANON_COOKIE = "tilca_aid";

/** Centro de La Paz (Plaza Murillo), para centrar el mapa. */
export const LA_PAZ_CENTER: [number, number] = [-16.5045, -68.1305];
