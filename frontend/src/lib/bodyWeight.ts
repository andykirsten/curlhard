import { format, subDays } from 'date-fns'

export interface WeightEntry {
  measured_on: string
  weight_kg: number
}

/**
 * Veränderung des letzten Eintrags gegenüber dem Eintrag, der am oder vor dem Tag `days` Tage
 * zurück liegt (kg, auf 0,1 gerundet). `entries` aufsteigend nach Datum; null ohne Vergleichswert.
 */
export function changeSince(entries: WeightEntry[], days: number, today: Date): number | null {
  const latest = entries.at(-1)
  if (!latest) return null
  const cutoff = format(subDays(today, days), 'yyyy-MM-dd')
  const reference = [...entries].reverse().find((e) => e.measured_on <= cutoff)
  if (!reference) return null
  return Math.round((latest.weight_kg - reference.weight_kg) * 10) / 10
}

/** „+0,5 kg“, „−1,2 kg“, „±0 kg“. */
export function formatChange(diff: number): string {
  const n = Math.abs(diff).toFixed(1).replace('.', ',').replace(/,0$/, '')
  if (diff === 0) return '±0 kg'
  return `${diff > 0 ? '+' : '−'}${n} kg`
}
