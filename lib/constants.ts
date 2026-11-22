export type Category = "teatro" | "musica" | "danza" | "standup" | "arte";
export type Channel = "whatsapp" | "mapa" | "amigo" | "busqueda";

export const CATEGORIES: { id: Category; label: string; color: string; ink: string }[] = [
  { id: "teatro", label: "Teatro", color: "#C8102E", ink: "#FFFFFF" },
  { id: "musica", label: "Música", color: "#F2B705", ink: "#17191E" },
  { id: "danza", label: "Danza", color: "#A23E5C", ink: "#FFFFFF" },
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

/** Comisión de TILCA: 5% del precio de cada entrada vendida con el código TILCA. */
export const COMISION_TILCA = 0.05;

/** "5%", para los textos. */
export const COMISION_LABEL = `${Math.round(COMISION_TILCA * 100)}%`;

/** Comisión en Bs por `sales` entradas a `price` Bs, redondeada a centavos. */
export function commissionFor(sales: number, price: number) {
  return Math.round(sales * price * COMISION_TILCA * 100) / 100;
}

export type SalesChannel = "ticketera" | "qr" | "puerta";
export const SALES_CHANNELS: { id: SalesChannel; label: string }[] = [
  { id: "ticketera", label: "Ticketera" },
  { id: "qr", label: "QR o transferencia" },
  { id: "puerta", label: "En puerta" },
];

export const TIME_ZONE = "America/La_Paz";

export const ANON_COOKIE = "tilca_aid";

/** Centro de La Paz (Plaza Murillo), para centrar el mapa. */
export const LA_PAZ_CENTER: [number, number] = [-16.5045, -68.1305];
