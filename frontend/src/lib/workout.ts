import { formatDate } from '@/lib/dates'
import { formatWeight } from '@/lib/weight'

const mayhew = (reps: number) => 1 / (0.522 + 0.419 * Math.exp(-0.055 * reps))

/**
 * Geschätztes Maximum wie in backend/app/services/stats.py: bis 15 Wdh. Epley, darüber die
 * an Epley angeschlossene, flachere Mayhew-Kurve (bei mehr als 30 Wdh. auf 30 begrenzt).
 * Mit RPE zählt die Reserve (10 − RPE, höchstens 4 Wdh.) zu den Wiederholungen.
 */
export function e1rm(weight: number, reps: number, rpe: number | null = null): number {
  const rir = rpe == null ? 0 : Math.min(Math.max(10 - rpe, 0), 4)
  const r = Math.min(reps + rir, 30)
  if (r <= 1) return weight
  if (r <= 15) return weight * (1 + r / 30)
  return (weight * 1.5 * mayhew(r)) / mayhew(15)
}

interface SetLike {
  reps: number
  weight_kg: number
  is_warmup: boolean
}

/** Volumen einer Übung: Σ Gewicht × Wdh ohne Aufwärmsätze (bei Zeitübungen Σ Sekunden). */
export function exerciseVolume(sets: SetLike[], loadType = 'weight'): number {
  return sets
    .filter((s) => !s.is_warmup)
    .reduce((sum, s) => sum + (loadType === 'time' ? s.reps : s.reps * s.weight_kg), 0)
}

export interface ExerciseProgress {
  /** Anzahl Arbeitssätze (ohne Aufwärmen) */
  done: number
  /** Ziel-Sätze laut Plan, null ohne Plan */
  target: number | null
  status: 'open' | 'started' | 'done'
}

/** Fortschritt einer Übung in der Session: Arbeitssätze gegen das Planziel. */
export function exerciseProgress(sets: SetLike[], targetSets?: number | null): ExerciseProgress {
  const done = sets.filter((s) => !s.is_warmup).length
  const target = targetSets != null && targetSets > 0 ? targetSets : null
  const status = target != null && done >= target ? 'done' : done > 0 ? 'started' : 'open'
  return { done, target, status }
}

/**
 * Herkunft der „Letztes Mal“-Werte: „Letztes Mal: Tag 2 · Mo, 05.10.“, bei Rückgriff auf eine
 * andere Session „anderes Training“, ohne Vorwerte „Noch kein Vergleich“.
 */
export function compareLabel(
  prev: { source_started_at: string | null; same_plan_day: boolean } | undefined,
  planDayName: string | null | undefined,
): string {
  if (!prev?.source_started_at) return 'Noch kein Vergleich'
  const source = prev.same_plan_day ? (planDayName ?? 'gleicher Tag') : 'anderes Training'
  return `Letztes Mal: ${source} · ${formatDate(prev.source_started_at, 'EEEEEE, dd.MM.')}`
}

/** Anteil am letzten Mal in Prozent (gerundet, nicht gedeckelt); null ohne Vergleichswert. */
export function volumePercent(today: number, last: number): number | null {
  if (last <= 0) return null
  return Math.round((today / last) * 100)
}

export interface Delta {
  text: string
  up: boolean
}

/**
 * Δ zum letzten Mal: zuerst Gewicht, bei gleichem Gewicht die Wdh, sonst „= gleich“.
 * Ohne Vorwert „neu“, Aufwärmsätze „Aufwärmen“.
 */
export function deltaLabel(
  set: { reps: number; weight_kg: number; is_warmup: boolean },
  prev: { reps: number; weight_kg: number } | undefined,
  loadType = 'weight',
): Delta {
  if (set.is_warmup) return { text: 'Aufwärmen', up: false }
  if (!prev) return { text: 'neu', up: false }
  if (loadType !== 'time' && set.weight_kg !== prev.weight_kg) {
    const diff = Math.round((set.weight_kg - prev.weight_kg) * 1000) / 1000
    const sign = diff > 0 ? '+' : '−'
    return {
      text: `${diff > 0 ? '▲' : '▼'} ${sign}${formatWeight(Math.abs(diff))} kg`,
      up: diff > 0,
    }
  }
  const dr = set.reps - prev.reps
  if (dr === 0) return { text: '= gleich', up: false }
  const unit = loadType === 'time' ? 's' : 'Wdh'
  return {
    text: `${dr > 0 ? '▲' : '▼'} ${dr > 0 ? '+' : '−'}${Math.abs(dr)} ${unit}`,
    up: dr > 0,
  }
}

/** Laufzeit als hh:mm:ss */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
