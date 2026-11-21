"use client";

/** Abre WhatsApp con el link del evento. El link lleva el canal "amigo". */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const text = `Mira este evento en tilca: ${title} ${url}`;
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-secondary h-12 flex-1 items-center justify-center gap-2 px-4 text-[15px] transition-transform active:scale-95"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Compartir
    </a>
  );
}
