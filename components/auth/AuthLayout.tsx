import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { LogoMark, Logo } from "../Logo";
import { Poster } from "../Poster";

const TILES = [
  { title: "La casa de los espejos", category: "teatro", organizer: "Teatro de Altura" },
  { title: "Noche de jazz", category: "musica" },
  { title: "Ciclo de cine boliviano", category: "dark" },
  { title: "Morenada contemporánea", category: "danza" },
  { title: "Cumbia en el Prado", category: "pink", organizer: "Sáb 28 nov" },
  { title: "Micro abierto", category: "standup" },
  { title: "Cholets", category: "arte" },
  { title: "Poesía en Sopocachi", category: "white" },
  { title: "Hamlet en aymara", category: "teatro" },
];

function Tile({ t }: { t: (typeof TILES)[number] }) {
  const special: Record<string, { bg: string; ink: string }> = {
    dark: { bg: BRAND.ink, ink: BRAND.surface },
    pink: { bg: BRAND.primary, ink: BRAND.surface },
    white: { bg: BRAND.surface, ink: BRAND.ink },
  };
  const s = special[t.category];
  if (s) {
    return (
      <div aria-hidden="true" className="flex flex-col justify-between overflow-hidden p-4" style={{ background: s.bg, color: s.ink }}>
        <span className="text-[11px]">{t.organizer ?? ""}</span>
        <span className="font-poster hyphens-auto break-words text-[34px] leading-[0.86]" lang="es">
          {t.title}
        </span>
      </div>
    );
  }
  return <Poster size="tile" title={t.title} category={t.category} organizer={t.organizer} />;
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-white">
      <aside
        aria-label="Afiches de eventos"
        className="relative hidden flex-none basis-[46%] max-w-[640px] grid-cols-3 gap-2.5 overflow-hidden bg-border p-2.5 lg:grid"
        style={{ gridAutoRows: "1fr" }}
      >
        {TILES.map((t) => (
          <Tile key={t.title} t={t} />
        ))}
        <div className="absolute right-8 bottom-8 left-8 rounded-panel bg-white px-7 py-6 shadow-[0_12px_32px_rgba(23,25,30,0.25)]">
          <LogoMark />
          <p className="mt-3 mb-0 max-w-[34ch] text-xl leading-[1.35] font-medium">
            Todo lo que pasa esta semana en los escenarios de La Paz, en un solo mapa.
          </p>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center px-4 sm:px-8 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-start justify-center px-4 py-8 sm:px-8 lg:items-center lg:py-12">
          <div className="flex w-full max-w-[440px] flex-col gap-5">{children}</div>
        </div>
      </main>
    </div>
  );
}
