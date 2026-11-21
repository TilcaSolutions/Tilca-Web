import Link from "next/link";

export function LogoMark({ size = 30 }: { size?: number }) {
  const dot = Math.round(size * 0.27);
  return (
    <span
      className="font-condensed group inline-flex items-baseline font-extrabold leading-none select-none tracking-[-0.5px]"
      style={{ fontSize: size, gap: 3 }}
    >
      <span className="transition-colors duration-200 group-hover:text-ink">tilca</span>
      <span
        aria-hidden="true"
        className="relative inline-block rounded-full bg-accent transition-transform duration-300 ease-out group-hover:scale-125"
        style={{ width: dot, height: dot }}
      >
        <span
          className="absolute inset-0 rounded-full bg-accent opacity-75 blur-[2px] transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden="true"
        />
      </span>
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
