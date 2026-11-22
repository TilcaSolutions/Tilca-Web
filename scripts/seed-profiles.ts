/**
 * Perfiles públicos de ejemplo (los usa scripts/seed.ts).
 * Las imágenes son ilustraciones de public/ejemplos/; las personas, los medios y las
 * citas son inventados y están marcados como ejemplo.
 */
import { emptyBlock, type ProfileConfig } from "../lib/profile/schema";

export const SAMPLE_PROFILES: Record<string, { slug: string; config: ProfileConfig }> = {
  "Teatro de Altura": {
    slug: "teatro-de-altura",
    config: {
      version: 1,
      theme: "telon",
      accent: null,
      font: null,
      tagline: "Teatro paceño desde 2009: comedia costumbrista, drama y funciones de medianoche.",
      avatar: "/ejemplos/teatro-logo.svg",
      cover: { kind: "image", url: "/ejemplos/teatro-portada.svg" },
      intro: "telon",
      introVideo: null,
      blocks: [
        { type: "proximos", visible: true },
        {
          type: "bio",
          visible: true,
          text:
            "Somos una compañía independiente de La Paz. Hacemos teatro sobre lo que nos pasa en la ciudad: las familias, los barrios, las herencias y lo que callamos.\n\nEnsayamos en Sopocachi y presentamos en el Teatro Municipal Alberto Saavedra Pérez y en salas independientes. (Perfil de ejemplo.)",
        },
        {
          type: "elenco",
          visible: true,
          people: [
            { name: "Valeria Quispe", role: "Dirección", photo: null },
            { name: "Marcelo Choque", role: "Actor", photo: null },
            { name: "Ana Lucía Mamani", role: "Actriz", photo: null },
            { name: "Jorge Villca", role: "Actor", photo: null },
            { name: "Paola Rojas", role: "Dramaturgia", photo: null },
            { name: "Diego Condori", role: "Iluminación", photo: null },
          ],
        },
        {
          type: "galeria",
          visible: true,
          photos: [
            { url: "/ejemplos/teatro-escena-1.svg", caption: "La casa de los espejos, 2026" },
            { url: "/ejemplos/teatro-escena-2.svg", caption: "El último tren" },
            { url: "/ejemplos/teatro-escena-3.svg", caption: "Ensayo general" },
          ],
        },
        {
          type: "prensa",
          visible: true,
          items: [
            { quote: "Una comedia que se ríe de nosotros con cariño. Salimos del teatro reconociendo a nuestras tías.", outlet: "Revista Escena Andina (ejemplo)", url: null },
            { quote: "El elenco sostiene noventa minutos de ritmo sin un solo bache.", outlet: "Butaca Paceña (ejemplo)", url: null },
          ],
        },
        { type: "pasados", visible: true },
        {
          type: "contacto",
          visible: true,
          email: "hola@teatrodealtura.bo",
          whatsapp: "",
          links: [{ network: "instagram", url: "https://www.instagram.com/" }],
        },
        emptyBlock("video"),
        emptyBlock("musica"),
      ],
    },
  },
  "Micro Abierto LPZ": {
    slug: "micro-abierto-lpz",
    config: {
      version: 1,
      theme: "neon",
      accent: null,
      font: null,
      tagline: "Stand up abierto: cinco minutos, un micrófono y La Paz escuchando.",
      avatar: "/ejemplos/micro-logo.svg",
      cover: { kind: "image", url: "/ejemplos/micro-portada.svg" },
      intro: "luces",
      introVideo: null,
      blocks: [
        { type: "proximos", visible: true },
        // Links de ejemplo: reemplazarlos por el video y la playlist reales del colectivo.
        { type: "video", visible: true, youtubeId: "jNQXAC9IVRw", title: "Lo mejor del último micro" },
        { type: "musica", visible: true, provider: "spotify", embedId: "playlist/37i9dQZF1DXcBWIGoYBM5M" },
        {
          type: "bio",
          visible: true,
          text: "Cada dos semanas abrimos el micrófono a quien quiera probar material. Sin filtro previo: te anotas en la puerta y subes. (Perfil de ejemplo.)",
        },
        { type: "pasados", visible: true },
        {
          type: "contacto",
          visible: true,
          email: "",
          whatsapp: "+59170000000",
          links: [
            { network: "instagram", url: "https://www.instagram.com/" },
            { network: "tiktok", url: "https://www.tiktok.com/" },
          ],
        },
        emptyBlock("galeria"),
        emptyBlock("elenco"),
        emptyBlock("prensa"),
      ],
    },
  },
};
