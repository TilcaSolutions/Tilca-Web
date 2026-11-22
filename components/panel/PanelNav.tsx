"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/panel",
    label: "Mis eventos",
    match: (p: string) => p === "/panel" || p.startsWith("/panel/evento/nuevo") || p.endsWith("/editar"),
    icon: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </>
    ),
  },
  {
    href: "/panel/estadisticas",
    label: "Estadísticas",
    match: (p: string) => p.startsWith("/panel/estadisticas") || (/^\/panel\/evento\/[^/]+$/.test(p) && !p.endsWith("/nuevo")),
    icon: <path d="M4 20V11M10 20V4M16 20v-6M21 20H3" />,
  },
  {
    href: "/panel/pagos",
    label: "Pagos y Escrow",
    match: (p: string) => p.startsWith("/panel/pagos") || p.includes("/presupuesto"),
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
  },
  {
    href: "/panel/perfil",
    label: "Perfil de la compañía",
    match: (p: string) => p.startsWith("/panel/perfil"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
  },
  {
    href: "/demo",
    label: "Stellar Demo ⚡",
    match: (p: string) => p === "/demo",
    icon: (
      <>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </>
    ),
  },
];

export function PanelNav() {
  const pathname = usePathname();
  return (
    <ul className="m-0 mt-2 flex list-none gap-0.5 overflow-x-auto p-0 [scrollbar-width:none] md:mt-0 md:flex-col">
      {ITEMS.map((item) => {
        const on = item.match(pathname);
        return (
          <li key={item.href} className="flex-none">
            <Link
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`flex h-10 items-center gap-2.5 rounded-control px-2.5 text-[15px] whitespace-nowrap transition-all duration-200 ${
                on ? "bg-fog font-semibold text-ink shadow-xs" : "text-ink-2 hover:bg-fog/60 hover:text-ink"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={on ? "text-primary" : "text-ink-3"}>
                {item.icon}
              </svg>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
