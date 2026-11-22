"use client";

/* eslint-disable @next/next/no-img-element -- miniaturas de archivos subidos */
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { publishProfile, saveProfileDraft } from "@/app/panel/perfil/actions";
import {
  BLOCK_LABELS,
  defaultProfile,
  FONT_IDS,
  INTRO_IDS,
  LIMITS,
  NETWORKS,
  parseProfile,
  spotifyId,
  THEME_IDS,
  youtubeId,
  type Block,
  type IntroId,
  type ProfileConfig,
} from "@/lib/profile/schema";
import { contrastWarnings, FONTS, resolveTheme, THEMES } from "@/lib/profile/themes";
import { createClient } from "@/lib/supabase/client";
import { IntroAnimation } from "./IntroAnimation";
import { ProfileView, type ProfileEvent } from "./ProfileView";

interface Props {
  userId: string;
  organizer: { name: string; slug: string };
  initial: ProfileConfig;
  published: ProfileConfig | null;
  upcoming: ProfileEvent[];
  past: ProfileEvent[];
}

const INTRO_LABELS: Record<IntroId, string> = {
  ninguna: "Ninguna",
  telon: "Telón que se abre",
  afiche: "Afiche que se despega",
  luces: "Luces de escenario",
  confeti: "Confeti",
  video: "Personalizada (tu video)",
};

const NETWORK_LABELS: Record<(typeof NETWORKS)[number], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  web: "Sitio web",
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

// --- Subida de archivos ------------------------------------------------------------

type Kind = "image" | "media" | "intro";
const IMAGE = /^image\/(jpeg|png|webp|gif)$/;
const VIDEO = /^video\/(mp4|webm)$/;

function videoDuration(file: File) {
  return new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration);
    };
    v.onerror = () => resolve(Infinity);
    v.src = URL.createObjectURL(file);
  });
}

async function upload(userId: string, file: File, kind: Kind): Promise<{ url?: string; error?: string }> {
  const isImage = IMAGE.test(file.type);
  const isVideo = VIDEO.test(file.type);
  if (kind === "image" && !isImage) return { error: "Sube una imagen JPG, PNG, WebP o GIF." };
  if (kind === "media" && !isImage && !isVideo) return { error: "Sube una imagen, un GIF o un video MP4 o WebM." };
  if (kind === "intro" && !isVideo) return { error: "Sube un video MP4 o WebM." };
  const max = kind === "intro" ? 3 : isVideo ? 8 : 5;
  if (file.size > max * 1024 * 1024) return { error: `El archivo pesa más de ${max} MB.` };
  if (kind === "intro" && (await videoDuration(file)) > 3.2) return { error: "El video de la animación puede durar hasta 3 segundos." };

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("perfiles").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "No pudimos subir el archivo. Inténtalo de nuevo." };
  return { url: supabase.storage.from("perfiles").getPublicUrl(path).data.publicUrl };
}

function UploadButton({
  userId,
  kind,
  label,
  accept,
  onUploaded,
  multiple,
}: {
  userId: string;
  kind: Kind;
  label: string;
  accept: string;
  onUploaded: (url: string) => void;
  multiple?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col gap-1">
      <label className="btn-secondary h-10 cursor-pointer self-start px-3.5 text-sm focus-within:outline-2 focus-within:outline-primary">
        {busy ? "Subiendo…" : label}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          disabled={busy}
          onChange={async (ev) => {
            const files = Array.from(ev.target.files ?? []);
            ev.target.value = "";
            if (!files.length) return;
            setBusy(true);
            setError(null);
            for (const f of files) {
              const res = await upload(userId, f, kind);
              if (res.url) onUploaded(res.url);
              else setError(res.error ?? "No se pudo subir.");
            }
            setBusy(false);
          }}
        />
      </label>
      {error && (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
    </span>
  );
}

// --- Editor ------------------------------------------------------------------------

export function ProfileEditor({ userId, organizer, initial, published, upcoming, past }: Props) {
  const [config, setConfig] = useState<ProfileConfig>(initial);
  const [publishedConfig, setPublishedConfig] = useState<ProfileConfig | null>(published);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [device, setDevice] = useState<"celular" | "escritorio">("celular");
  const [replay, setReplay] = useState(0);
  const [openBlock, setOpenBlock] = useState<Block["type"] | null>(null);
  const [isPublishing, startPublish] = useTransition();

  // La vista previa usa la misma limpieza que el servidor: lo que se ve es lo que se publica.
  const clean = useMemo(() => parseProfile(config), [config]);
  const theme = resolveTheme(clean);
  const warnings = contrastWarnings(theme);
  const dirty = JSON.stringify(clean) !== JSON.stringify(publishedConfig ?? defaultProfile());

  // Borrador: se guarda solo, un momento después del último cambio.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      setStatus("saving");
      const res = await saveProfileDraft(config);
      setStatus(res.ok ? "saved" : "error");
    }, 800);
    return () => clearTimeout(timer);
  }, [config]);

  const update = (patch: Partial<ProfileConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const updateBlock = (type: Block["type"], patch: Record<string, unknown>) =>
    setConfig((c) => ({ ...c, blocks: c.blocks.map((b) => (b.type === type ? ({ ...b, ...patch } as Block) : b)) }));
  // Varias fotos se suben en paralelo: cada una se agrega sobre el estado más reciente.
  const addPhoto = (url: string) =>
    setConfig((c) => ({
      ...c,
      blocks: c.blocks.map((b) => (b.type === "galeria" ? { ...b, photos: [...b.photos, { url, caption: "" }].slice(0, LIMITS.photos) } : b)),
    }));
  const moveBlock = (from: number, to: number) =>
    setConfig((c) => {
      if (to < 0 || to >= c.blocks.length || from === to) return c;
      const blocks = [...c.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...c, blocks };
    });

  function publish() {
    setMessage(null);
    startPublish(async () => {
      const res = await publishProfile(config);
      if (res.ok && res.config) {
        setPublishedConfig(res.config);
        setMessage("Listo: tu perfil público ya muestra estos cambios.");
      } else setMessage(res.message ?? "No pudimos publicar.");
    });
  }

  const dragFrom = useRef<number | null>(null);
  const section = "flex flex-col gap-3 border-t border-line pt-5";
  const h2 = "m-0 text-[15px] font-semibold";

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-ink-2" aria-live="polite">
          {status === "saving"
            ? "Guardando borrador…"
            : status === "error"
              ? "No se pudo guardar el borrador."
              : dirty
                ? "Borrador guardado · hay cambios sin publicar"
                : "Todo publicado"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/o/${organizer.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary h-10 px-3.5 text-sm">
            Ver mi perfil ↗
          </a>
          <button
            type="button"
            className="btn-secondary h-10 px-3.5 text-sm"
            onClick={() => {
              if (confirm("¿Volver al diseño por defecto? Se pierde la personalización del borrador (lo publicado no cambia hasta que publiques).")) {
                setConfig(defaultProfile());
              }
            }}
          >
            Restablecer diseño por defecto
          </button>
          <button type="button" onClick={publish} disabled={isPublishing || !dirty} className="btn-primary h-10 px-4 text-sm">
            {isPublishing ? "Publicando…" : "Publicar cambios"}
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="m-0 rounded-control bg-primary-soft px-3.5 py-2.5 text-sm text-primary">
          {message}
        </p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* Controles */}
        <div className="panel flex flex-col gap-5 p-5">
          <section className="flex flex-col gap-3" aria-labelledby="ed-tema">
            <h2 id="ed-tema" className={h2}>
              Tema
            </h2>
            <div role="radiogroup" aria-labelledby="ed-tema" className="grid grid-cols-1 gap-2">
              {THEME_IDS.map((id) => {
                const t = THEMES[id];
                const on = config.theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => update({ theme: id })}
                    className={`flex items-center gap-3 rounded-control border p-2.5 text-left transition-colors ${
                      on ? "border-primary bg-primary-soft" : "border-line hover:border-control"
                    }`}
                  >
                    <span aria-hidden="true" className="flex h-10 w-14 flex-none items-end overflow-hidden rounded-[6px] border border-line" style={{ background: t.bg }}>
                      <span className="m-1.5 h-2.5 w-6 rounded-full" style={{ background: t.accent }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="block text-xs text-ink-2">{t.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={section} aria-labelledby="ed-color">
            <h2 id="ed-color" className={h2}>
              Color de acento
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                aria-label="Color de acento"
                value={theme.accent}
                onChange={(ev) => update({ accent: ev.target.value })}
                className="h-10 w-14 cursor-pointer rounded-control border border-line bg-surface p-1"
              />
              <span className="font-mono text-sm">{theme.accent}</span>
              {config.accent && (
                <button type="button" className="link-underline text-sm text-ink-2" onClick={() => update({ accent: null })}>
                  Usar el del tema
                </button>
              )}
            </div>
            {warnings.map((w) => (
              <p key={w} role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-[13px] text-warn-ink">
                {w}
              </p>
            ))}
          </section>

          <section className={section} aria-labelledby="ed-fuente">
            <h2 id="ed-fuente" className={h2}>
              Tipografía de títulos
            </h2>
            <div role="radiogroup" aria-labelledby="ed-fuente" className="grid grid-cols-2 gap-2">
              {FONT_IDS.map((id) => {
                const on = theme.font === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => update({ font: id === THEMES[config.theme].font ? null : id })}
                    className={`rounded-control border px-3 py-2 text-left text-lg ${on ? "border-primary bg-primary-soft" : "border-line hover:border-control"}`}
                    style={{ fontFamily: FONTS[id].cssVar }}
                  >
                    {FONTS[id].label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={section} aria-labelledby="ed-portada">
            <h2 id="ed-portada" className={h2}>
              Portada
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="label">Frase corta</span>
              <input
                className="field"
                maxLength={LIMITS.tagline}
                value={config.tagline}
                onChange={(ev) => update({ tagline: ev.target.value })}
                placeholder="Teatro paceño desde 2009"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {config.avatar && <img src={config.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />}
              <UploadButton
                userId={userId}
                kind="image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                label={config.avatar ? "Cambiar foto o logo" : "Subir foto o logo"}
                onUploaded={(url) => update({ avatar: url })}
              />
              {config.avatar && (
                <button type="button" className="link-underline text-sm text-ink-2" onClick={() => update({ avatar: null })}>
                  Quitar
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <UploadButton
                userId={userId}
                kind="media"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                label={config.cover ? "Cambiar portada" : "Subir portada (imagen, GIF o video)"}
                onUploaded={(url) => update({ cover: { kind: /\.(mp4|webm)$/i.test(url) ? "video" : "image", url } })}
              />
              {config.cover && (
                <button type="button" className="link-underline text-sm text-ink-2" onClick={() => update({ cover: null })}>
                  Quitar portada
                </button>
              )}
            </div>
            <span className="text-[13px] text-ink-3">El video de portada se reproduce sin sonido y en loop. Hasta 8 MB.</span>
          </section>

          <section className={section} aria-labelledby="ed-intro">
            <div className="flex items-center justify-between gap-2">
              <h2 id="ed-intro" className={h2}>
                Animación de entrada
              </h2>
              {clean.intro !== "ninguna" && (
                <button type="button" className="link-underline text-sm font-semibold text-primary" onClick={() => setReplay((n) => n + 1)}>
                  ▶ Ver animación
                </button>
              )}
            </div>
            <div role="radiogroup" aria-labelledby="ed-intro" className="grid grid-cols-2 gap-2">
              {INTRO_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={config.intro === id}
                  onClick={() => {
                    update({ intro: id });
                    if (id !== "ninguna") setReplay((n) => n + 1);
                  }}
                  className={`rounded-control border px-3 py-2 text-left text-sm ${config.intro === id ? "border-primary bg-primary-soft font-semibold" : "border-line hover:border-control"}`}
                >
                  {INTRO_LABELS[id]}
                </button>
              ))}
            </div>
            {config.intro === "video" && (
              <div className="flex flex-col gap-2">
                <UploadButton
                  userId={userId}
                  kind="intro"
                  accept="video/mp4,video/webm"
                  label={config.introVideo ? "Cambiar video" : "Subir video (hasta 3 s y 3 MB)"}
                  onUploaded={(url) => {
                    update({ introVideo: url });
                    setReplay((n) => n + 1);
                  }}
                />
                {!config.introVideo && <span className="text-[13px] text-ink-3">Sin video, no se muestra ninguna animación.</span>}
              </div>
            )}
            <span className="text-[13px] text-ink-3">
              Se ve una vez por visita, se puede saltar con un toque y no aparece para quien tiene desactivadas las animaciones.
            </span>
          </section>

          <section className={section} aria-labelledby="ed-bloques">
            <h2 id="ed-bloques" className={h2}>
              Bloques
            </h2>
            <span className="-mt-1.5 text-[13px] text-ink-3">Arrástralos (o usa las flechas) para cambiar el orden.</span>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {config.blocks.map((b, i) => (
                <li
                  key={b.type}
                  draggable
                  onDragStart={(ev) => {
                    dragFrom.current = i;
                    ev.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(ev) => ev.preventDefault()}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    if (dragFrom.current !== null) moveBlock(dragFrom.current, i);
                    dragFrom.current = null;
                  }}
                  className={`rounded-control border bg-surface ${b.visible ? "border-line" : "border-dashed border-line opacity-70"}`}
                >
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <span aria-hidden="true" className="cursor-grab px-1 text-ink-3 select-none" title="Arrastrar">
                      ⋮⋮
                    </span>
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={b.visible}
                        onChange={(ev) => updateBlock(b.type, { visible: ev.target.checked })}
                        className="h-4 w-4 accent-primary"
                        aria-label={`Mostrar ${BLOCK_LABELS[b.type]}`}
                      />
                      <span className="truncate">{BLOCK_LABELS[b.type]}</span>
                    </label>
                    <button type="button" aria-label={`Subir ${BLOCK_LABELS[b.type]}`} disabled={i === 0} onClick={() => moveBlock(i, i - 1)} className="h-8 w-8 rounded-[6px] text-ink-2 hover:bg-fog disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Bajar ${BLOCK_LABELS[b.type]}`}
                      disabled={i === config.blocks.length - 1}
                      onClick={() => moveBlock(i, i + 1)}
                      className="h-8 w-8 rounded-[6px] text-ink-2 hover:bg-fog disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-expanded={openBlock === b.type}
                      onClick={() => setOpenBlock(openBlock === b.type ? null : b.type)}
                      className="h-8 rounded-[6px] px-2 text-sm font-semibold text-primary hover:bg-fog"
                    >
                      {openBlock === b.type ? "Cerrar" : "Editar"}
                    </button>
                  </div>
                  {openBlock === b.type && (
                    <div className="flex flex-col gap-3 border-t border-line p-3">
                      <BlockEditor block={b} userId={userId} onChange={(patch) => updateBlock(b.type, patch)} addPhoto={addPhoto} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Vista previa */}
        <div className="flex flex-col gap-3 xl:sticky xl:top-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-[15px] font-semibold">Vista previa</h2>
            <div role="group" aria-label="Dispositivo" className="flex rounded-control bg-line p-[3px]">
              {(["celular", "escritorio"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={device === d}
                  onClick={() => setDevice(d)}
                  className={`h-8 rounded-[6px] px-3 text-sm capitalize ${device === d ? "bg-white font-semibold shadow-[0_1px_2px_rgba(23,25,30,0.18)]" : "text-ink-2"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <PreviewFrame device={device}>
            <ProfileView config={clean} organizer={organizer} upcoming={upcoming} past={past} preview />
            <IntroAnimation
              intro={clean.intro}
              videoUrl={clean.introVideo}
              slug={organizer.slug}
              name={organizer.name}
              accent={theme.accent}
              accentInk={theme.accentInk}
              fontFamily={theme.fontFamily}
              contained
              replay={replay}
            />
          </PreviewFrame>
        </div>
      </div>
    </div>
  );
}

/**
 * Marco de la vista previa. "Celular": 390 px de ancho. "Escritorio": se dibuja a 1280 px
 * y se achica con `zoom` para que entre en la columna.
 */
function PreviewFrame({ device, children }: { device: "celular" | "escritorio"; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [view, preview] = children as ReactNode[];
  const phone = device === "celular";
  const zoom = phone ? 1 : Math.min(1, width / 1280);

  return (
    <div ref={outer} className="w-full">
      <div
        className={`relative mx-auto overflow-hidden border border-line bg-white shadow-[0_12px_32px_rgba(23,25,30,0.14)] ${phone ? "rounded-[28px] border-[6px] border-ink" : "rounded-[10px]"}`}
        style={phone ? { width: 390, maxWidth: "100%", height: 760 } : { width: 1280 * zoom, height: 760 }}
      >
        <div className="h-full overflow-y-auto" style={phone ? undefined : { width: 1280, height: 760 / zoom, zoom }}>
          {view}
        </div>
        {preview}
      </div>
    </div>
  );
}

// --- Contenido de cada bloque --------------------------------------------------------

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

/** Campo de link que guarda solo el id que reconoce (YouTube o Spotify). */
function LinkField({ label, initial, parse, onValue, hint }: { label: string; initial: string; parse: (v: string) => string | null; onValue: (id: string | null) => void; hint: string }) {
  const [text, setText] = useState(initial);
  const bad = text.trim() !== "" && !parse(text);
  return (
    <Field label={label} hint={bad ? undefined : hint}>
      <input
        className="field"
        type="url"
        inputMode="url"
        value={text}
        aria-invalid={bad || undefined}
        onChange={(ev) => {
          setText(ev.target.value);
          onValue(parse(ev.target.value));
        }}
      />
      {bad && <span className="text-[12px] text-danger">No reconocemos ese link.</span>}
    </Field>
  );
}

function BlockEditor({
  block,
  userId,
  onChange,
  addPhoto,
}: {
  block: Block;
  userId: string;
  onChange: (patch: Record<string, unknown>) => void;
  addPhoto: (url: string) => void;
}) {
  const remove = "link-underline self-start text-[13px] text-ink-2";
  switch (block.type) {
    case "proximos":
    case "pasados":
      return <p className="m-0 text-sm text-ink-2">Se llena solo con tus eventos publicados. Fecha, lugar, precio y compra se ven igual que en el resto de TILCA.</p>;
    case "bio":
      return (
        <Field label="Texto" hint={`${block.text.length} de ${LIMITS.bio} caracteres`}>
          <textarea className="field" rows={6} maxLength={LIMITS.bio} value={block.text} onChange={(ev) => onChange({ text: ev.target.value })} />
        </Field>
      );
    case "galeria":
      return (
        <>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {block.photos.map((p, i) => (
              <li key={`${p.url}-${i}`} className="flex items-center gap-2">
                <img src={p.url} alt="" className="h-12 w-16 flex-none rounded-[4px] object-cover" />
                <input
                  className="field h-10 min-w-0 flex-1 text-sm"
                  placeholder="Pie de foto (opcional)"
                  maxLength={LIMITS.caption}
                  value={p.caption}
                  onChange={(ev) => onChange({ photos: block.photos.map((x, k) => (k === i ? { ...x, caption: ev.target.value } : x)) })}
                />
                <button type="button" className="text-sm text-ink-2" aria-label="Quitar foto" onClick={() => onChange({ photos: block.photos.filter((_, k) => k !== i) })}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {block.photos.length < LIMITS.photos && (
            <UploadButton userId={userId} kind="image" accept="image/jpeg,image/png,image/webp,image/gif" label="+ Agregar fotos" multiple onUploaded={addPhoto} />
          )}
        </>
      );
    case "video":
      return (
        <>
          <LinkField
            label="Link de YouTube"
            initial={block.youtubeId ? `https://youtu.be/${block.youtubeId}` : ""}
            parse={youtubeId}
            onValue={(id) => onChange({ youtubeId: id })}
            hint="Por ejemplo, https://youtu.be/…"
          />
          <Field label="Título del bloque (opcional)">
            <input className="field" maxLength={LIMITS.caption} value={block.title} onChange={(ev) => onChange({ title: ev.target.value })} placeholder="Video" />
          </Field>
        </>
      );
    case "musica":
      return (
        <>
          <Field label="Plataforma">
            <select className="field" value={block.provider} onChange={(ev) => onChange({ provider: ev.target.value, embedId: null })}>
              <option value="spotify">Spotify</option>
              <option value="youtube">YouTube</option>
            </select>
          </Field>
          <LinkField
            key={block.provider}
            label={block.provider === "spotify" ? "Link de Spotify" : "Link de YouTube"}
            initial={block.embedId ? (block.provider === "spotify" ? `https://open.spotify.com/${block.embedId}` : `https://youtu.be/${block.embedId}`) : ""}
            parse={block.provider === "spotify" ? spotifyId : youtubeId}
            onValue={(id) => onChange({ embedId: id })}
            hint={block.provider === "spotify" ? "Un álbum, playlist, canción o artista." : "Un video o una canción."}
          />
        </>
      );
    case "elenco":
      return (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {block.people.map((p, i) => {
              const set = (patch: Record<string, unknown>) => onChange({ people: block.people.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
              return (
                <li key={i} className="flex flex-col gap-2 rounded-control bg-fog p-2.5">
                  <div className="flex gap-2">
                    <input className="field h-10 min-w-0 flex-1 text-sm" placeholder="Nombre" maxLength={LIMITS.name} value={p.name} onChange={(ev) => set({ name: ev.target.value })} />
                    <input className="field h-10 min-w-0 flex-1 text-sm" placeholder="Rol" maxLength={LIMITS.role} value={p.role} onChange={(ev) => set({ role: ev.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    {p.photo && <img src={p.photo} alt="" className="h-9 w-9 rounded-full object-cover" />}
                    <UploadButton userId={userId} kind="image" accept="image/jpeg,image/png,image/webp" label={p.photo ? "Cambiar foto" : "Foto (opcional)"} onUploaded={(url) => set({ photo: url })} />
                    <button type="button" className={`${remove} ml-auto`} onClick={() => onChange({ people: block.people.filter((_, k) => k !== i) })}>
                      Quitar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {block.people.length < LIMITS.people && (
            <button type="button" className="btn-secondary h-10 self-start px-3.5 text-sm" onClick={() => onChange({ people: [...block.people, { name: "", role: "", photo: null }] })}>
              + Agregar integrante
            </button>
          )}
          <span className="text-[12px] text-ink-3">Los integrantes sin nombre no se publican.</span>
        </>
      );
    case "prensa":
      return (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {block.items.map((q, i) => {
              const set = (patch: Record<string, unknown>) => onChange({ items: block.items.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
              return (
                <li key={i} className="flex flex-col gap-2 rounded-control bg-fog p-2.5">
                  <textarea className="field text-sm" rows={3} placeholder="Cita" maxLength={LIMITS.quote} value={q.quote} onChange={(ev) => set({ quote: ev.target.value })} />
                  <div className="flex gap-2">
                    <input className="field h-10 min-w-0 flex-1 text-sm" placeholder="Medio" maxLength={LIMITS.outlet} value={q.outlet} onChange={(ev) => set({ outlet: ev.target.value })} />
                    <input className="field h-10 min-w-0 flex-1 text-sm" type="url" placeholder="https://… (opcional)" value={q.url ?? ""} onChange={(ev) => set({ url: ev.target.value || null })} />
                  </div>
                  <button type="button" className={remove} onClick={() => onChange({ items: block.items.filter((_, k) => k !== i) })}>
                    Quitar
                  </button>
                </li>
              );
            })}
          </ul>
          {block.items.length < LIMITS.press && (
            <button type="button" className="btn-secondary h-10 self-start px-3.5 text-sm" onClick={() => onChange({ items: [...block.items, { quote: "", outlet: "", url: null }] })}>
              + Agregar reseña
            </button>
          )}
        </>
      );
    case "contacto":
      return (
        <>
          <Field label="Correo">
            <input className="field" type="email" value={block.email} onChange={(ev) => onChange({ email: ev.target.value })} placeholder="hola@tucompania.bo" />
          </Field>
          <Field label="WhatsApp" hint="Con código de país, por ejemplo +59171234567.">
            <input className="field" type="tel" inputMode="tel" value={block.whatsapp} onChange={(ev) => onChange({ whatsapp: ev.target.value })} />
          </Field>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {block.links.map((l, i) => {
              const set = (patch: Record<string, unknown>) => onChange({ links: block.links.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
              return (
                <li key={i} className="flex gap-2">
                  <select className="field h-10 w-[130px] flex-none text-sm" value={l.network} onChange={(ev) => set({ network: ev.target.value })}>
                    {NETWORKS.map((n) => (
                      <option key={n} value={n}>
                        {NETWORK_LABELS[n]}
                      </option>
                    ))}
                  </select>
                  <input className="field h-10 min-w-0 flex-1 text-sm" type="url" placeholder="https://…" value={l.url} onChange={(ev) => set({ url: ev.target.value })} />
                  <button type="button" className="text-sm text-ink-2" aria-label="Quitar red" onClick={() => onChange({ links: block.links.filter((_, k) => k !== i) })}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          {block.links.length < LIMITS.links && (
            <button type="button" className="btn-secondary h-10 self-start px-3.5 text-sm" onClick={() => onChange({ links: [...block.links, { network: "instagram", url: "" }] })}>
              + Agregar red
            </button>
          )}
          <span className="text-[12px] text-ink-3">Solo se publican links que empiezan con https://.</span>
        </>
      );
  }
}
