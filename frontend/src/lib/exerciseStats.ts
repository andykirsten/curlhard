import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { parseApiDate } from '@/lib/dates'
import { formatWeight, roundToStep } from '@/lib/weight'

export const kg = (v: number | null | undefined) => (v == null ? '–' : `${formatWeight(v)} kg`)

export const signedPct = (v: number | null | undefined) =>
  v == null ? undefined : `${v > 0 ? '+' : ''}${String(v).replace('.', ',')} %`

/** Zahl mit deutschem Tausenderpunkt, z. B. 42300 -> „42.300“. */
export const formatInt = (v: number) => Math.round(v).toLocaleString('de-DE')

/** Tonnage lesbar: ab 1000 kg in Tonnen („42,3 t“), sonst in kg. */
export function formatTonnage(volumeKg: number): string {
  if (volumeKg >= 1000) {
    return `${String(Math.round(volumeKg / 100) / 10).replace('.', ',')} t`
  }
  return `${formatInt(volumeKg)} kg`
}

/** Sekunden als „1:30 min“ bzw. „45 s“. */
export function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')} min`
}

/** Formatiert einen reinen Kalendertag (yyyy-MM-dd) ohne Zeitzonen-Verschiebung. */
export const formatDay = (key: string, pattern: string) =>
  format(parseISO(key), pattern, { locale: de })

export interface PrTarget {
  reps: number
  /** Zielgewicht in kg (auf `step` gerundet) */
  weight: number
  /** aktueller Bestwert bei mindestens `reps` Wdh. (null = noch nie erreicht) */
  current: number | null
}

interface ProfileLike {
  reps: number
  actual_kg: number | null
  estimated_kg: number
}

/**
 * Nächstes PR-Ziel für n Wiederholungen: mindestens ein Schritt über dem echten Bestwert,
 * mindestens aber die gerundete Epley-Schätzung (liegt der Bestwert darunter, ist ein PR
 * „leicht drin“). Null, wenn es keine Schätzung gibt.
 */
export function prTarget(
  profile: readonly ProfileLike[],
  reps: number,
  step: number,
): PrTarget | null {
  const row = profile.find((p) => p.reps === reps)
  if (!row || row.estimated_kg <= 0) return null
  const current = row.actual_kg
  const estimate = roundToStep(row.estimated_kg, step)
  const above = current != null ? roundToStep(current + step, step) : estimate
  return { reps, weight: Math.max(estimate, above), current }
}

export interface HeatCell {
  /** ISO-Datum (yyyy-MM-dd), null für Zellen nach heute */
  key: string | null
  /** Anzahl Trainings an dem Tag (0 oder 1, da das Backend Tage dedupliziert) */
  count: number
  level: 0 | 1
}

/**
 * Heatmap im GitHub-Stil: `weeks` Wochenspalten (Mo–So), die letzte endet mit der aktuellen
 * Woche. `trainingDays` sind ISO-Datumsstrings. Zellen nach `now` bleiben leer (key null).
 * Level 1 = Training an diesem Tag, sonst 0.
 */
export function buildHeatmap(
  trainingDays: readonly string[],
  now: Date,
  weeks = 26,
): { columns: HeatCell[][]; trainedWeeks: number } {
  const set = new Set(trainingDays)
  const firstWeek = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), -(weeks - 1))
  const today = format(now, 'yyyy-MM-dd')
  const columns: HeatCell[][] = []
  let trainedWeeks = 0
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = []
    let any = false
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstWeek, w * 7 + d)
      const key = format(date, 'yyyy-MM-dd')
      if (key > today) {
        col.push({ key: null, count: 0, level: 0 })
        continue
      }
      const trained = set.has(key)
      if (trained) any = true
      col.push({ key, count: trained ? 1 : 0, level: trained ? 1 : 0 })
    }
    if (any) trainedWeeks += 1
    columns.push(col)
  }
  return { columns, trainedWeeks }
}

/** Gruppiert nach Monat („Oktober 2026“), Reihenfolge der Eingabe bleibt erhalten. */
export function groupByMonth<T>(
  items: readonly T[],
  dateOf: (item: T) => string,
): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = []
  for (const item of items) {
    const d = parseApiDate(dateOf(item))
    const key = format(d, 'yyyy-MM')
    let g = groups.at(-1)
    if (g?.key !== key) {
      g = { key, label: format(d, 'LLLL yyyy', { locale: de }), items: [] }
      groups.push(g)
    }
    g.items.push(item)
  }
  return groups
}

/** „vor 3 Tagen“ für PR-Zeilen; heute/gestern ausgeschrieben. */
export function daysAgoLabel(iso: string, now: Date = new Date()): string {
  const days = Math.max(differenceInCalendarDays(now, parseApiDate(iso)), 0)
  if (days === 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 14) return `vor ${days} Tagen`
  if (days < 60) return `vor ${Math.round(days / 7)} Wochen`
  return `vor ${Math.round(days / 30)} Monaten`
}

/** SVG-Pfad (Linie) für eine Sparkline; null-Werte werden übersprungen. */
export function sparklinePath(
  values: readonly (number | null)[],
  width: number,
  height: number,
  pad = 3,
): { line: string; area: string; last: [number, number] | null } {
  const pts = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null)
  if (pts.length === 0) return { line: '', area: '', last: null }
  const min = Math.min(...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v))
  const span = max - min || 1
  const n = Math.max(values.length - 1, 1)
  const xy = pts.map((p): [number, number] => [
    pad + (p.i / n) * (width - 2 * pad),
    pad + (1 - (p.v - min) / span) * (height - 2 * pad),
  ])
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const first = xy[0]!
  const last = xy[xy.length - 1]!
  const area = `${line} L${last[0].toFixed(1)} ${height} L${first[0].toFixed(1)} ${height} Z`
  return { line, area, last }
}

/** Beschriftung eines PR-Ereignisses, z. B. „Neues e1RM-Hoch“ oder „Neuer 8RM“. */
export function prLabel(kind: string, reps: number | null): string {
  if (kind === 'e1rm') return 'Neues e1RM-Hoch'
  if (kind === 'reps') return 'Neue Wiederholungs-Bestmarke'
  return reps === 1 ? 'Neues 1RM' : `Neuer ${reps}RM`
}
