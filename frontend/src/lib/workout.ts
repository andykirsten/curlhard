import { formatWeight } from '@/lib/weight'

/** Geschätztes Maximum nach Epley (wie in backend/app/services/stats.py) */
export function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
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
