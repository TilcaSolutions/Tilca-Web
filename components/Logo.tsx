import Link from "next/link";
import { CAT_PATH, CAT_TRANSFORM, CAT_VIEWBOX, WORD_PATH, WORD_TRANSFORM, WORD_VIEWBOX } from "@/lib/brand";

/** La cabeza del gato del logo, en el amarillo de la marca. */
export function LogoCat({ height }: { height: number }) {
  return (
    <svg
      viewBox={`0 0 ${CAT_VIEWBOX.width} ${CAT_VIEWBOX.height}`}
      aria-hidden="true"
      style={{ height, width: (height * CAT_VIEWBOX.width) / CAT_VIEWBOX.height }}
      className="flex-none"
    >
      <path transform={CAT_TRANSFORM} d={CAT_PATH} className="fill-logo-cat" />
    </svg>
  );
}

/** Gato + "tilca" en horizontal. `size` equivale al tamaño de letra de la palabra. */
export function LogoMark({ size = 30 }: { size?: number }) {
  const wordHeight = size * 0.78;
  return (
    <span className="inline-flex items-center leading-none select-none" style={{ gap: size * 0.28 }}>
      <LogoCat height={Math.round(size * 1.2)} />
      <svg
        viewBox={`0 0 ${WORD_VIEWBOX.width} ${WORD_VIEWBOX.height}`}
        role="img"
        aria-label="tilca"
        style={{ height: wordHeight, width: (wordHeight * WORD_VIEWBOX.width) / WORD_VIEWBOX.height }}
        className="flex-none"
      >
        <path transform={WORD_TRANSFORM} d={WORD_PATH} className="fill-logo-word" />
      </svg>
    </span>
  );
}

export function Logo({ size = 30, href = "/", label = "TILCA, inicio" }: { size?: number; href?: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className="flex-none rounded transition-transform active:scale-95">
      <LogoMark size={size} />
    </Link>
  );
}
