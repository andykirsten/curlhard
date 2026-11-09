/** Zielbereich für Arbeitssätze pro Muskelgruppe und Woche (gängige Hypertrophie-Empfehlung). */
export const TARGET_MIN = 10
export const TARGET_MAX = 20

export type BalanceStatus = 'low' | 'ok' | 'high'

export const STATUS_LABEL: Record<BalanceStatus, string> = {
  low: `unter ${TARGET_MIN}`,
  ok: 'im Bereich',
  high: `über ${TARGET_MAX}`,
}

export function balanceStatus(setsPerWeek: number): BalanceStatus {
  if (setsPerWeek < TARGET_MIN) return 'low'
  return setsPerWeek > TARGET_MAX ? 'high' : 'ok'
}

/** Skalenende der Balken: mindestens knapp über dem Zielbereich, sonst der größte Wert. */
export function scaleMax(values: number[]): number {
  return Math.max(TARGET_MAX + 5, ...values)
}

/** Balkenbreite in Prozent (0–100). */
export function barPercent(value: number, max: number): number {
  return Math.min(100, Math.max(0, (value / max) * 100))
}

export function formatSets(value: number): string {
  return String(value).replace('.', ',')
}
