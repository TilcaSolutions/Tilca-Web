import { Bebas_Neue, Cormorant_Garamond, Fraunces, Playfair_Display, Space_Grotesk } from "next/font/google";

// Tipografías de títulos del perfil. Se cargan solo en las páginas que muestran perfiles
// (/o/[slug] y el editor). Archivo ya viene del layout raíz.
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], variable: "--pf-playfair", display: "swap", preload: false });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--pf-bebas", display: "swap", preload: false });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--pf-cormorant", display: "swap", preload: false });
const space = Space_Grotesk({ subsets: ["latin"], weight: ["400", "700"], variable: "--pf-space", display: "swap", preload: false });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "800"], variable: "--pf-fraunces", display: "swap", preload: false });

/** Clases que definen las variables CSS de las fuentes del perfil. */
export const profileFontVars = [playfair, bebas, cormorant, space, fraunces].map((f) => f.variable).join(" ");
