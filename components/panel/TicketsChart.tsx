import { CHANNELS, type Channel } from "@/lib/constants";
import { lpParts, weekdayLong } from "@/lib/format";

interface Day {
  date: Date;
  count: number;
  topChannel: Channel | null;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Barras de una sola serie: entradas atribuidas a TILCA por día. */
export function TicketsChart({ days }: { days: Day[] }) {
  const W = 640;
  const H = 290;
  const left = 34;
  const right = 632;
  const top = 34;
  const base = 262;
  const max = Math.max(...days.map((d) => d.count), 0);
  // Eje en tercios con números enteros: 0, 2, 4, 6 si el máximo es 5.
  const yMax = Math.max(3, Math.ceil(max / 3) * 3);
  const ticks = [0, yMax / 3, (2 * yMax) / 3, yMax];
  const y = (v: number) => base - (v / yMax) * (base - top);
  const slot = (right - left) / days.length;
  const barW = Math.max(3, Math.min(24, slot * 0.56));
  const labelEvery = days.length <= 16 ? 1 : days.length <= 32 ? 2 : 5;

  const peakIdx = max > 0 ? days.findLastIndex((d) => d.count === max) : -1;
  const peak = peakIdx >= 0 ? days[peakIdx] : null;
  const peakX = peak ? left + slot * peakIdx + slot / 2 : 0;
  const peakNote =
    peak?.topChannel === "whatsapp"
      ? "salió en la cartelera de WhatsApp"
      : peak?.topChannel
        ? `la mayoría llegó por ${CHANNELS.find((c) => c.id === peak.topChannel)?.label.toLowerCase()}`
        : null;
  const peakLabel = peak ? `${max} el ${weekdayLong(peak.date.toISOString())} ${lpParts(peak.date).day}` : "";
  const anchorEnd = peakX > W / 2;

  const total = days.reduce((s, d) => s + d.count, 0);
  const summary = peak
    ? `Entradas por día; ${total} en total. El pico fue el ${weekdayLong(peak.date.toISOString())} ${lpParts(peak.date).day} con ${max}.`
    : "Todavía no hay ventas confirmadas en este periodo.";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} className="block">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={left} x2={right} y1={y(t)} y2={y(t)} className={i === 0 ? "stroke-border-strong" : "stroke-border"} strokeWidth="1" />
          <text x={26} y={y(t) + 4} textAnchor="end" fontSize="11" className="fill-muted">
            {t}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const cx = left + slot * i + slot / 2;
        const p = lpParts(d.date);
        const h = base - y(d.count);
        const r = Math.min(4, barW / 2, h);
        return (
          <g key={d.date.toISOString()}>
            {d.count > 0 && (
              <path
                d={`M${cx - barW / 2} ${base} V${base - h + r} Q${cx - barW / 2} ${base - h} ${cx - barW / 2 + r} ${base - h} H${cx + barW / 2 - r} Q${cx + barW / 2} ${base - h} ${cx + barW / 2} ${base - h + r} V${base} Z`}
                className="fill-chart transition-all duration-200 hover:opacity-80 cursor-pointer"
              >
                <title>{`${weekdayLong(d.date.toISOString())} ${p.day} ${MONTHS[p.month]}: ${d.count} ${d.count === 1 ? "entrada" : "entradas"}`}</title>
              </path>
            )}
            {i % labelEvery === 0 && (
              <text x={cx} y={280} textAnchor="middle" fontSize="11" className="fill-muted">
                {p.day}
              </text>
            )}
          </g>
        );
      })}
      {peak && (
        <>
          <text
            x={anchorEnd ? peakX - barW / 2 - 6 : peakX + barW / 2 + 6}
            y={y(max) + 4}
            textAnchor={anchorEnd ? "end" : "start"}
            fontSize="12"
            className="fill-ink"
            fontWeight="600"
          >
            {peakLabel}
          </text>
          {peakNote && (
            <text
              x={anchorEnd ? peakX - barW / 2 - 6 : peakX + barW / 2 + 6}
              y={y(max) + 20}
              textAnchor={anchorEnd ? "end" : "start"}
              fontSize="12"
              className="fill-ink-2"
            >
              {peakNote}
            </text>
          )}
        </>
      )}
      {!peak && (
        <text x={(left + right) / 2} y={150} textAnchor="middle" fontSize="13" className="fill-muted">
          Todavía no hay ventas confirmadas en este periodo
        </text>
      )}
    </svg>
  );
}
