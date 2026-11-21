/**
 * Referencia de "eventos parecidos": qué porcentaje del aforo suelen tener
 * vendido según los días que faltan. Para el prototipo es una curva fija;
 * cuando haya datos reales, calcularla con eventos pasados de la misma categoría.
 */
const CURVE: [daysLeft: number, pct: number][] = [
  [42, 10],
  [28, 25],
  [21, 40],
  [14, 55],
  [7, 70],
  [0, 85],
];

export function expectedPct(daysLeft: number) {
  if (daysLeft >= CURVE[0][0]) return CURVE[0][1];
  for (let i = 0; i < CURVE.length - 1; i++) {
    const [d1, p1] = CURVE[i];
    const [d2, p2] = CURVE[i + 1];
    if (daysLeft <= d1 && daysLeft >= d2) {
      return Math.round(p2 + ((daysLeft - d2) / (d1 - d2)) * (p1 - p2));
    }
  }
  return CURVE[CURVE.length - 1][1];
}

export interface SalesPace {
  sold: number;
  capacity: number;
  pct: number;
  expected: number;
  daysLeft: number;
  slow: boolean;
}

export function salesPace(sold: number, capacity: number | null, startsAt: string | null, now = new Date()): SalesPace | null {
  if (!capacity || !startsAt) return null;
  const daysLeft = Math.ceil((new Date(startsAt).getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return null;
  const pct = Math.round((sold / capacity) * 100);
  const expected = expectedPct(daysLeft);
  return { sold, capacity, pct, expected, daysLeft, slow: pct < expected - 15 };
}

export function weeksLabel(days: number) {
  if (days <= 0) return "es hoy";
  if (days === 1) return "falta 1 día";
  if (days < 14) return `faltan ${days} días`;
  return `faltan ${Math.round(days / 7)} semanas`;
}
