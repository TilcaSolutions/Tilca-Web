/* eslint-disable @next/next/no-img-element -- los afiches vienen de Supabase Storage con tamaños variables */
import { categoryInfo } from "@/lib/constants";
import { formatDayMonth } from "@/lib/format";
import { shortVenue } from "@/lib/venues";

type PosterSize = "xs" | "sm" | "card" | "md" | "lg" | "tile";

const SIZES: Record<Exclude<PosterSize, "tile">, { w: number; h: number; pad: number; radius: number; max: number }> = {
  xs: { w: 34, h: 46, pad: 0, radius: 3, max: 0 },
  sm: { w: 60, h: 80, pad: 6, radius: 4, max: 17 },
  card: { w: 54, h: 72, pad: 5, radius: 4, max: 15 },
  md: { w: 132, h: 176, pad: 12, radius: 6, max: 34 },
  lg: { w: 168, h: 224, pad: 14, radius: 6, max: 44 },
};

interface PosterProps {
  title: string;
  category: string;
  posterUrl?: string | null;
  size?: PosterSize;
  organizer?: string | null;
  startsAt?: string | null;
  venue?: string | null;
  muted?: boolean;
  className?: string;
}

/**
 * Texto del afiche: la parte corta del título, como en los mockups.
 * "Cholets: arquitectura de lo nuestro" -> "Cholets"; "Noche de jazz con Cuarteto Altiplano" -> "Noche de jazz".
 */
export function posterTitle(title: string) {
  let t = title.split(/[:|–—]/)[0].trim();
  if (t.split(/\s+/).length > 4) {
    const cut = t.search(/\s(con|en|de la|por)\s/i);
    if (cut > 0) t = t.slice(0, cut);
  }
  return t || title;
}

/** Tamaño del título según el ancho disponible y la palabra más larga. */
function titleSize(title: string, textWidth: number, max: number) {
  const longest = Math.min(8, Math.max(...title.split(/\s+/).map((w) => w.length), 4));
  return Math.min(max, Math.floor(textWidth / (longest * 0.62)));
}

function Ornament({ category, scale }: { category: string; scale: number }) {
  if (category === "musica") {
    const s = Math.round(18 * scale);
    return (
      <span
        className="block rounded-full border-ink"
        style={{ width: s, height: s, borderWidth: Math.max(2, Math.round(3 * scale)), borderStyle: "solid" }}
      />
    );
  }
  if (category === "arte") {
    const w = Math.round(8 * scale);
    const h = Math.round(14 * scale);
    return (
      <span className="flex" style={{ gap: Math.max(2, Math.round(2 * scale)) }}>
        {["#F2B705", "#1E7FC2", "#C8102E"].map((c) => (
          <span key={c} style={{ width: w, height: h, background: c }} />
        ))}
      </span>
    );
  }
  return null;
}

/**
 * Afiche del evento. Si no hay imagen subida, genera uno tipográfico
 * con el color de la categoría y el título en mayúsculas condensadas.
 */
export function Poster({
  title,
  category,
  posterUrl,
  size = "sm",
  organizer,
  startsAt,
  venue,
  muted,
  className = "",
}: PosterProps) {
  const cat = categoryInfo(category);
  const bg = muted ? "#8C929B" : cat.color;
  const ink = muted ? "#FFFFFF" : cat.ink;

  if (size === "tile") {
    return (
      <div
        aria-hidden="true"
        className={`flex flex-col justify-between overflow-hidden p-4 ${className}`}
        style={{ background: bg, color: ink }}
      >
        {organizer ? <span className="text-[11px]">{organizer}</span> : <Ornament category={category} scale={2.4} />}
        <span className="font-poster hyphens-auto break-words text-[34px] leading-[0.86] sm:text-[40px]">{title}</span>
      </div>
    );
  }

  const s = SIZES[size];
  const box = { width: s.w, height: s.h, borderRadius: s.radius };

  if (posterUrl) {
    return (
      <img
        src={posterUrl}
        alt={size === "lg" || size === "md" ? `Afiche de ${title}` : ""}
        aria-hidden={size === "lg" || size === "md" ? undefined : true}
        className={`flex-none object-cover ${className}`}
        style={{ ...box, background: bg }}
        loading={size === "lg" ? "eager" : "lazy"}
      />
    );
  }

  if (size === "xs") {
    return <span aria-hidden="true" className={`block flex-none ${className}`} style={{ ...box, background: bg }} />;
  }

  const text = posterTitle(title);
  const fontSize = titleSize(text, s.w - s.pad * 2, s.max);
  const ornament = <Ornament category={category} scale={size === "lg" ? 2 : size === "md" ? 1.6 : 1} />;
  const hasOrnament = category === "musica" || category === "arte";

  if (size === "lg" || size === "md") {
    return (
      <div
        role="img"
        aria-label={`Afiche de ${title}`}
        className={`relative flex flex-none flex-col justify-between overflow-hidden ${className}`}
        style={{ ...box, padding: s.pad, background: bg, color: ink }}
      >
        {organizer ? (
          <span className="text-[11px] font-medium opacity-85">{organizer} presenta</span>
        ) : (
          ornament
        )}
        <span
          lang="es"
          className="font-poster hyphens-auto break-words"
          style={{ fontSize, lineHeight: 0.86, letterSpacing: "-0.5px" }}
        >
          {text}
        </span>
        <span className="flex justify-between gap-2 text-[11px] font-semibold">
          <span>{startsAt ? formatDayMonth(startsAt) : ""}</span>
          <span className="truncate">{shortVenue(venue ?? null)}</span>
        </span>
      </div>
    );
  }

  return (
    <span
      aria-hidden="true"
      lang="es"
      className={`flex flex-none flex-col overflow-hidden ${hasOrnament ? "justify-between" : "justify-end"} ${className}`}
      style={{ ...box, padding: s.pad, background: bg, color: ink, boxSizing: "border-box" }}
    >
      {hasOrnament && ornament}
      <span className="font-poster hyphens-auto break-words" style={{ fontSize, lineHeight: 0.92 }}>
        {text}
      </span>
    </span>
  );
}
