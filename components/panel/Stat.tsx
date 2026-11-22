/** Una cifra del resumen (se usa dentro de un grid con `gap-px bg-line`). */
export function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-5 py-4 sm:px-[22px]">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="font-condensed text-[30px] leading-none font-bold tabular">{value}</span>
      <span className="text-xs text-ink-3">{note}</span>
    </div>
  );
}
