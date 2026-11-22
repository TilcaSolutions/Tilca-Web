"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { IntroId } from "@/lib/profile/schema";

/**
 * Animación de entrada del perfil (máximo 2 s; el video propio, hasta 3 s).
 * - Se salta con un toque, con Escape o con el botón "Saltar".
 * - No se reproduce con `prefers-reduced-motion`.
 * - En la página pública se ve una sola vez por sesión y por perfil.
 * - En la vista previa del editor (`contained`) queda dentro del marco y se repite con `replay`.
 */

interface Props {
  intro: IntroId;
  videoUrl: string | null;
  slug: string;
  name: string;
  accent: string;
  accentInk: string;
  fontFamily: string;
  contained?: boolean;
  replay?: number;
}

const DURATION: Record<IntroId, number> = { ninguna: 0, telon: 2000, afiche: 2000, luces: 2000, confeti: 2000, video: 3600 };

// La decisión de reproducir se toma una vez por montaje (clave) y se recuerda aquí, así
// leer y marcar sessionStorage no se repite en cada render.
const decisions = new Map<string, boolean>();
const noop = () => () => {};

function decide(key: string, props: Props): boolean {
  const cached = decisions.get(key);
  if (cached !== undefined) return cached;
  let play = props.intro !== "ninguna" && !(props.intro === "video" && !props.videoUrl);
  if (play && window.matchMedia("(prefers-reduced-motion: reduce)").matches) play = false;
  if (play && !props.contained) {
    const seen = `tilca-intro:${props.slug}`;
    try {
      if (sessionStorage.getItem(seen)) play = false;
      else sessionStorage.setItem(seen, "1");
    } catch {
      // Sin sessionStorage (modo privado estricto): se reproduce igual.
    }
  }
  if (play && props.contained && !props.replay) play = false;
  decisions.set(key, play);
  return play;
}

export function IntroAnimation(props: Props) {
  const { intro, videoUrl, name, accent, accentInk, fontFamily, contained, replay = 0, slug } = props;
  const key = `${slug}:${intro}:${contained ? "preview" : "public"}:${replay}`;
  const play = useSyncExternalStore(noop, () => decide(key, props), () => false);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const show = play && doneKey !== key;

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setDoneKey(key), DURATION[intro]);
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setDoneKey(key);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [show, key, intro]);

  if (!show) return null;
  const skip = () => setDoneKey(key);

  return (
    <div
      role="presentation"
      onClick={skip}
      className={`${contained ? "absolute" : "fixed"} inset-0 z-[200] cursor-pointer overflow-hidden intro-${intro}`}
      style={{ "--intro-accent": accent, "--intro-ink": accentInk, "--intro-font": fontFamily } as CSSProperties}
    >
      {intro === "telon" && (
        <>
          <span className="intro-half intro-half-l" />
          <span className="intro-half intro-half-r" />
          <span className="intro-valance" />
        </>
      )}
      {intro === "afiche" && (
        <span className="intro-poster">
          <span className="intro-pin" />
          <span className="intro-poster-name">{name}</span>
        </span>
      )}
      {intro === "luces" && (
        <>
          <span className="intro-spot" style={{ left: "18%", animationDelay: "0.1s" }} />
          <span className="intro-spot" style={{ left: "50%", animationDelay: "0.45s" }} />
          <span className="intro-spot" style={{ left: "82%", animationDelay: "0.8s" }} />
          <span className="intro-stage-name">{name}</span>
        </>
      )}
      {intro === "confeti" &&
        Array.from({ length: 70 }, (_, i) => (
          <span
            key={i}
            className="intro-confetti"
            style={{
              left: `${(i * 37) % 100}%`,
              background: CONFETTI[i % CONFETTI.length] === "accent" ? accent : CONFETTI[i % CONFETTI.length],
              animationDelay: `${((i * 13) % 50) / 100}s`,
              animationDuration: `${1.1 + ((i * 7) % 6) / 10}s`,
              width: 6 + (i % 3) * 3,
              height: 10 + (i % 4) * 3,
              ["--spin" as string]: `${(i % 2 ? 1 : -1) * (360 + ((i * 53) % 360))}deg`,
            }}
          />
        ))}
      {intro === "video" && videoUrl && (
        <video src={videoUrl} autoPlay muted playsInline onEnded={skip} className="h-full w-full object-cover" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          skip();
        }}
        className="absolute right-4 bottom-4 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
      >
        Saltar
      </button>
    </div>
  );
}

const CONFETTI = ["accent", "#f6c200", "#e6007e", "#00b4d8", "#1b7f3b", "#ffffff", "#f28c28"];
