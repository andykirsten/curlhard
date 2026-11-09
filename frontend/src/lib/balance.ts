/**
 * Der Sollwert ist relativ: Die am meisten trainierte Muskelgruppe (höchste Wochensatzzahl)
 * ist 100 %, alle anderen werden dazu ins Verhältnis gesetzt.
 */
export function referenceSets(values: number[]): number {
  return Math.max(0, ...values)
}

/** Anteil am Referenzwert in ganzen Prozent (0–100). */
export function balancePercent(value: number, reference: number): number {
  if (reference <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / reference) * 100)))
}

export function formatSets(value: number): string {
  return String(value).replace('.', ',')
}
