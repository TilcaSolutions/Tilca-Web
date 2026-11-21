/**
 * Lugares culturales conocidos de La Paz, para sugerir al publicar un evento
 * y para los datos de ejemplo. Coordenadas aproximadas (a nivel de cuadra).
 */
export interface Venue {
  name: string;
  short: string;
  address: string;
  zone: string;
  lat: number;
  lng: number;
}

export const VENUES: Venue[] = [
  {
    name: "Teatro Municipal Alberto Saavedra Pérez",
    short: "Teatro Municipal",
    address: "Calle Genaro Sanjinés esq. Indaburo",
    zone: "Centro",
    lat: -16.4969,
    lng: -68.134,
  },
  {
    name: "Museo Nacional de Arte",
    short: "Museo Nacional de Arte",
    address: "Calle Comercio esq. Socabaya",
    zone: "Centro",
    lat: -16.4963,
    lng: -68.1346,
  },
  {
    name: "Espacio Simón I. Patiño",
    short: "Espacio Simón I. Patiño",
    address: "Av. Ecuador 2503",
    zone: "Sopocachi",
    lat: -16.511,
    lng: -68.127,
  },
  {
    name: "Thelonious Jazz Bar",
    short: "Thelonious Jazz Bar",
    address: "Av. 20 de Octubre 2172",
    zone: "Sopocachi",
    lat: -16.507,
    lng: -68.129,
  },
  {
    name: "Equinoccio",
    short: "Equinoccio",
    address: "Av. Sánchez Lima 2191",
    zone: "Sopocachi",
    lat: -16.5095,
    lng: -68.1285,
  },
  {
    name: "Centro Cultural de España en La Paz",
    short: "Centro Cultural de España",
    address: "Av. Arce esq. Plaza Isabel la Católica",
    zone: "San Jorge",
    lat: -16.512,
    lng: -68.1235,
  },
  {
    name: "Cinemateca Boliviana",
    short: "Cinemateca Boliviana",
    address: "Calle Óscar Soria esq. Rosendo Gutiérrez",
    zone: "Sopocachi",
    lat: -16.5065,
    lng: -68.1295,
  },
  {
    name: "Casa de la Cultura",
    short: "Casa de la Cultura",
    address: "Av. Mariscal Santa Cruz esq. Potosí",
    zone: "Centro",
    lat: -16.499,
    lng: -68.1345,
  },
  {
    name: "Teatro al Aire Libre Jaime Laredo",
    short: "Teatro al Aire Libre",
    address: "Av. del Ejército",
    zone: "Miraflores",
    lat: -16.506,
    lng: -68.125,
  },
  {
    name: "Museo Nacional de Etnografía y Folklore",
    short: "MUSEF",
    address: "Calle Ingavi 916",
    zone: "Centro",
    lat: -16.495,
    lng: -68.1325,
  },
  {
    name: "Alianza Francesa de La Paz",
    short: "Alianza Francesa",
    address: "Av. 20 de Octubre 2315",
    zone: "Sopocachi",
    lat: -16.5085,
    lng: -68.13,
  },
  {
    name: "Goethe-Institut La Paz",
    short: "Goethe-Institut",
    address: "Av. Arce 2708",
    zone: "San Jorge",
    lat: -16.5135,
    lng: -68.1215,
  },
  {
    name: "Museos de la Calle Jaén",
    short: "Calle Jaén",
    address: "Calle Jaén",
    zone: "Centro",
    lat: -16.4925,
    lng: -68.1365,
  },
];

export function venueByName(name: string) {
  const v = VENUES.find((x) => x.name === name);
  if (!v) throw new Error(`Lugar desconocido: ${name}`);
  return v;
}

/** Nombre corto para afiches y tablas: "Teatro Municipal". */
export function shortVenue(name: string | null) {
  if (!name) return "";
  return VENUES.find((v) => v.name === name)?.short ?? name;
}
