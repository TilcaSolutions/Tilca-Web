/* eslint-disable @next/next/no-img-element -- imágenes subidas por el organizador (Supabase Storage) */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Poster } from "@/components/Poster";
import { categoryInfo } from "@/lib/constants";
import { formatPrice, formatWhen } from "@/lib/format";
import { BLOCK_LABELS, type Block, type Network, type ProfileConfig } from "@/lib/profile/schema";
import { resolveTheme, type ResolvedTheme } from "@/lib/profile/themes";

/**
 * El perfil público de un organizador. Lo usan la página /o/[slug] y la vista previa
 * del editor, así lo que se ve al editar es lo que se publica.
 *
 * Usa container queries (@container) en vez de breakpoints de pantalla: así la vista
 * previa "Celular" del editor se ve como en un celular aunque esté en una pantalla grande.
 *
 * Las tarjetas de eventos (fecha, lugar, precio y botón de compra) usan siempre el estilo
 * de la app: el tema cambia lo de alrededor, nunca la información clave.
 */

export interface ProfileEvent {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  poster_url: string | null;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  venue_zone: string | null;
  price: number | null;
}

interface Props {
  config: ProfileConfig;
  organizer: { name: string; slug: string };
  upcoming: ProfileEvent[];
  past: ProfileEvent[];
  /** En el editor: muestra los bloques vacíos con una ayuda, y los links abren en otra pestaña. */
  preview?: boolean;
}

const AGUAYO_STRIPES =
  "repeating-linear-gradient(90deg,#c8102e 0 18px,#f28c28 18px 36px,#1b7f3b 36px 54px,#e6007e 54px 72px,#6a2c91 72px 90px,#f6c200 90px 108px)";
const AGUAYO_DIAMONDS = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 4 44 24 24 44 4 24Z" fill="none" stroke="#c8102e" stroke-width="2" opacity=".07"/><path d="M24 16 32 24 24 32 16 24Z" fill="#f28c28" opacity=".08"/></svg>',
)}")`;

function heroBackground(t: ResolvedTheme): string {
  switch (t.id) {
    case "telon":
      return "repeating-linear-gradient(90deg,#5c0d17 0 26px,#7a1421 26px 40px,#4a0a12 40px 64px),#5c0d17";
    case "neon":
      return `radial-gradient(60% 80% at 20% 20%, color-mix(in srgb, ${t.accent} 55%, transparent), transparent 70%), radial-gradient(50% 70% at 85% 30%, rgba(0,229,255,.35), transparent 70%), #0b0b12`;
    case "aguayo":
      return `linear-gradient(rgba(43,26,18,.35),rgba(43,26,18,.35)), ${AGUAYO_STRIPES}`;
    case "galeria":
      return "#f2f2f2";
    default:
      return `radial-gradient(70% 90% at 80% 10%, color-mix(in srgb, ${t.accent} 70%, white 10%), transparent 70%), ${t.accent}`;
  }
}

function cardClass(t: ResolvedTheme) {
  switch (t.card) {
    case "flat":
      return "bg-[var(--p-surface)] border-t border-[var(--p-line)] pt-4";
    case "outline":
      return "bg-[var(--p-surface)] rounded-[12px] border border-[color-mix(in_srgb,var(--p-accent)_45%,transparent)] shadow-[0_0_28px_-10px_var(--p-accent)] p-4";
    case "framed":
      return "bg-[var(--p-surface)] rounded-[8px] border-2 border-[color-mix(in_srgb,var(--p-accent)_65%,transparent)] p-4";
    default:
      return "bg-[var(--p-surface)] rounded-[14px] border border-[var(--p-line)] shadow-[0_1px_3px_rgba(23,25,30,0.08)] p-4";
  }
}

export function ProfileView({ config, organizer, upcoming, past, preview }: Props) {
  const t = resolveTheme(config);
  const style = {
    "--p-bg": t.bg,
    "--p-surface": t.surface,
    "--p-text": t.text,
    "--p-muted": t.muted,
    "--p-line": t.line,
    "--p-accent": t.accent,
    "--p-accent-ink": t.accentInk,
    "--p-title": t.fontFamily,
    "--p-title-weight": t.titleWeight,
    backgroundColor: t.bg,
    backgroundImage: t.pattern === "aguayo" ? AGUAYO_DIAMONDS : undefined,
    color: t.text,
  } as CSSProperties;

  const hasMedia = !!config.cover;
  const heroInk = t.id === "galeria" && !hasMedia ? t.text : "#ffffff";
  const target: Record<string, string> = preview ? { target: "_blank", rel: "noopener noreferrer" } : {};
  const visible = config.blocks.filter((b) => b.visible);

  return (
    <div className="@container min-h-full" style={style}>
      {/* Portada */}
      <header className="relative isolate overflow-hidden" style={{ background: hasMedia ? "#111" : heroBackground(t), color: heroInk }}>
        {config.cover?.kind === "video" ? (
          <video
            key={config.cover.url}
            src={config.cover.url}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        ) : config.cover?.kind === "image" ? (
          <img src={config.cover.url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        ) : null}
        {heroInk === "#ffffff" && (
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_20%,rgba(0,0,0,0.62))]" />
        )}
        <div className="mx-auto flex min-h-[300px] max-w-[1080px] flex-col justify-end gap-4 px-5 pt-16 pb-8 @2xl:min-h-[420px] @2xl:flex-row @2xl:items-end @2xl:px-8 @2xl:pb-10">
          {config.avatar ? (
            <img
              src={config.avatar}
              alt={`Foto de ${organizer.name}`}
              className="h-24 w-24 flex-none rounded-full border-4 object-cover shadow-lg @2xl:h-32 @2xl:w-32"
              style={{ borderColor: t.bg }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-24 w-24 flex-none items-center justify-center rounded-full border-4 text-3xl font-bold shadow-lg @2xl:h-32 @2xl:w-32 @2xl:text-4xl"
              style={{ background: t.accent, color: t.accentInk, borderColor: t.bg, fontFamily: t.fontFamily }}
            >
              {initials(organizer.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1
              className="m-0 text-[40px] leading-[0.95] tracking-[-0.5px] [text-wrap:balance] @2xl:text-[64px]"
              style={{ fontFamily: t.fontFamily, fontWeight: t.titleWeight }}
            >
              {organizer.name}
            </h1>
            {config.tagline && <p className="m-0 mt-2.5 max-w-[52ch] text-[17px] leading-snug opacity-90 @2xl:text-xl">{config.tagline}</p>}
          </div>
        </div>
      </header>
      {t.pattern === "aguayo" && <div aria-hidden="true" className="h-2.5" style={{ backgroundImage: AGUAYO_STRIPES }} />}

      {/* Bloques */}
      <main className="mx-auto flex max-w-[1080px] flex-col gap-12 px-5 py-10 @2xl:gap-16 @2xl:px-8 @2xl:py-14">
        {visible.map((b) => {
          const content = renderBlock(b, { t, upcoming, past, target, preview: !!preview });
          if (!content) return null;
          return (
            <section key={b.type} aria-labelledby={`b-${b.type}`} className="flex flex-col gap-5">
              <h2
                id={`b-${b.type}`}
                className="m-0 flex items-center gap-3 text-[28px] leading-none @2xl:text-[34px]"
                style={{ fontFamily: t.fontFamily, fontWeight: t.titleWeight }}
              >
                <span aria-hidden="true" className="h-[0.7em] w-1.5 flex-none rounded-full" style={{ background: t.accent }} />
                {b.type === "video" && b.title ? b.title : BLOCK_LABELS[b.type]}
              </h2>
              {content}
            </section>
          );
        })}
      </main>

      <footer className="border-t border-[var(--p-line)] px-5 py-6 text-center text-sm text-[var(--p-muted)]">
        Perfil en{" "}
        <Link href="/" className="font-semibold underline underline-offset-2" {...target}>
          tilca
        </Link>
        , la cartelera cultural de La Paz.
      </footer>
    </div>
  );
}

type Ctx = {
  t: ResolvedTheme;
  upcoming: ProfileEvent[];
  past: ProfileEvent[];
  target: Record<string, string>;
  preview: boolean;
};

function EmptyHint({ type }: { type: Block["type"] }) {
  return (
    <p className="m-0 rounded-[10px] border-2 border-dashed border-[var(--p-line)] p-5 text-sm text-[var(--p-muted)]">
      {BLOCK_LABELS[type]}: todavía no tiene contenido. Llénalo en el editor o escóndelo; vacío no se muestra en tu perfil.
    </p>
  );
}

function renderBlock(b: Block, ctx: Ctx): ReactNode {
  const { t, target, preview } = ctx;
  const card = cardClass(t);
  const empty = preview ? <EmptyHint type={b.type} /> : null;

  switch (b.type) {
    case "proximos":
      return ctx.upcoming.length ? (
        <ul className="m-0 grid list-none gap-3 p-0 @2xl:grid-cols-2">
          {ctx.upcoming.map((e) => (
            <EventCard key={e.id} e={e} target={target} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[var(--p-muted)]">No hay funciones próximas por ahora.</p>
      );
    case "pasados":
      return ctx.past.length ? (
        <ul className="m-0 grid list-none gap-3 p-0 @2xl:grid-cols-2">
          {ctx.past.map((e) => (
            <EventCard key={e.id} e={e} target={target} past />
          ))}
        </ul>
      ) : (
        empty
      );
    case "bio":
      return b.text ? (
        <p className="m-0 max-w-[68ch] text-[17px] leading-[1.65] whitespace-pre-line @2xl:text-lg">{b.text}</p>
      ) : (
        empty
      );
    case "galeria":
      return b.photos.length ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 @2xl:grid-cols-3">
          {b.photos.map((p, i) => (
            <li key={`${p.url}-${i}`} className="m-0">
              <figure className="m-0 flex flex-col gap-1.5">
                <img src={p.url} alt={p.caption || `Foto ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-[8px] object-cover" />
                {p.caption && <figcaption className="text-sm text-[var(--p-muted)]">{p.caption}</figcaption>}
              </figure>
            </li>
          ))}
        </ul>
      ) : (
        empty
      );
    case "video":
      return b.youtubeId ? <YouTube id={b.youtubeId} title={b.title || "Video"} /> : empty;
    case "musica":
      if (!b.embedId) return empty;
      return b.provider === "youtube" ? (
        <YouTube id={b.embedId} title="Música" />
      ) : (
        <iframe
          title="Música en Spotify"
          src={`https://open.spotify.com/embed/${b.embedId}`}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="h-[352px] w-full max-w-[720px] rounded-[12px] border-0"
          style={{ height: b.embedId.startsWith("track/") || b.embedId.startsWith("episode/") ? 152 : 352 }}
        />
      );
    case "elenco":
      return b.people.length ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 @2xl:grid-cols-4">
          {b.people.map((p, i) => (
            <li key={`${p.name}-${i}`} className={`m-0 flex flex-col items-center gap-2 text-center ${card}`}>
              {p.photo ? (
                <img src={p.photo} alt="" loading="lazy" className="h-24 w-24 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold"
                  style={{ background: `color-mix(in srgb, ${t.accent} 22%, ${t.surface})`, color: t.text, fontFamily: t.fontFamily }}
                >
                  {initials(p.name)}
                </span>
              )}
              <span className="font-semibold">{p.name}</span>
              {p.role && <span className="-mt-1.5 text-sm text-[var(--p-muted)]">{p.role}</span>}
            </li>
          ))}
        </ul>
      ) : (
        empty
      );
    case "prensa":
      return b.items.length ? (
        <ul className="m-0 grid list-none gap-3 p-0 @2xl:grid-cols-2">
          {b.items.map((q, i) => (
            <li key={i} className={`m-0 ${card}`}>
              <figure className="m-0 flex flex-col gap-3">
                <blockquote className="m-0 text-[17px] leading-relaxed" style={{ fontFamily: t.fontFamily }}>
                  <span aria-hidden="true" className="mr-1 text-3xl leading-none" style={{ color: t.accent }}>
                    “
                  </span>
                  {q.quote}
                </blockquote>
                <figcaption className="text-sm text-[var(--p-muted)]">
                  {q.outlet && <span className="font-semibold text-[var(--p-text)]">{q.outlet}</span>}
                  {q.url && (
                    <>
                      {q.outlet ? " · " : ""}
                      <a href={q.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        Leer la nota ↗
                      </a>
                    </>
                  )}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      ) : (
        empty
      );
    case "contacto": {
      const items: { href: string; label: string }[] = [];
      if (b.email) items.push({ href: `mailto:${b.email}`, label: b.email });
      if (b.whatsapp) items.push({ href: `https://wa.me/${b.whatsapp.replace(/\D/g, "")}`, label: "WhatsApp" });
      for (const l of b.links) items.push({ href: l.url, label: NETWORK_LABELS[l.network] });
      return items.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
          {items.map((it) => (
            <li key={it.href}>
              <a
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-full px-5 text-[15px] font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: t.accent, color: t.accentInk }}
              >
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        empty
      );
    }
  }
}

const NETWORK_LABELS: Record<Network, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  web: "Sitio web",
};

function YouTube({ id, title }: { id: string; title: string }) {
  return (
    <div className="aspect-video w-full max-w-[860px] overflow-hidden rounded-[12px] bg-black">
      <iframe
        title={title}
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}

/** Tarjeta de evento con el estilo de la app (no depende del tema). */
function EventCard({ e, target, past }: { e: ProfileEvent; target: Record<string, string>; past?: boolean }) {
  const cat = categoryInfo(e.category);
  return (
    <li className="m-0 flex gap-3.5 rounded-[12px] border border-line bg-surface p-3.5 text-ink shadow-[0_1px_2px_rgba(23,25,30,0.06)]">
      <Poster title={e.title} category={e.category} posterUrl={e.poster_url} size="sm" muted={past} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="line-clamp-2 text-base font-semibold">{e.title}</span>
        <span className="line-clamp-1 text-sm text-ink-2">
          {e.venue_name}
          {e.venue_zone ? `, ${e.venue_zone}` : ""}
        </span>
        <span className="text-sm font-medium text-ink-2">{formatWhen(e)}</span>
        <span className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
          {e.subcategory ? e.subcategory.charAt(0).toUpperCase() + e.subcategory.slice(1) : cat.label}
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-line/60 bg-fog px-2 py-1 text-sm font-semibold whitespace-nowrap tabular">{formatPrice(e.price)}</span>
          {past ? (
            <Link href={`/evento/${e.id}`} className="text-sm font-semibold text-ink-2 underline underline-offset-2" {...target}>
              Ya pasó · ver ficha
            </Link>
          ) : (
            <Link href={`/evento/${e.id}`} className="btn-primary h-9 px-3.5 text-sm" {...target}>
              {Number(e.price) === 0 ? "Ver evento" : "Comprar entrada"}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || name.slice(0, 2).toUpperCase()
  );
}
