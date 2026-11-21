import { LogoMark } from "@/components/Logo";
import { PanelNav } from "@/components/panel/PanelNav";
import { signOut } from "@/app/auth/actions";
import { initials, requireOrganizer } from "@/lib/organizer";
import Link from "next/link";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const { organizer } = await requireOrganizer();
  return (
    <div className="flex min-h-dvh flex-col bg-fog md:flex-row">
      <nav
        aria-label="Menú del organizador"
        className="flex flex-none flex-col gap-0.5 border-line bg-white px-3 py-3 md:sticky md:top-0 md:h-dvh md:basis-[232px] md:border-r md:py-5"
      >
        <div className="flex items-center justify-between md:block">
          <Link href="/" aria-label="TILCA, ver el mapa" className="block rounded px-2.5">
            <LogoMark size={28} />
          </Link>
          <span className="block px-2.5 text-[13px] text-ink-3 md:pt-1 md:pb-5">Para organizadores</span>
        </div>
        <PanelNav />
        <div className="mt-auto hidden items-center gap-2.5 border-t border-line px-2.5 pt-3 md:flex">
          <span className="font-condensed flex h-8 w-8 flex-none items-center justify-center rounded-[6px] bg-[#C8102E] text-sm font-extrabold text-white">
            {initials(organizer.name) || "T"}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{organizer.name}</span>
            <span className="text-xs text-ink-3">{organizer.is_sample ? "Cuenta de ejemplo" : "Organizador"}</span>
          </span>
          <form action={signOut}>
            <button type="submit" className="rounded px-1 text-xs font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:px-10 sm:py-8">{children}</main>
    </div>
  );
}
