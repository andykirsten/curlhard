import { roundToStep } from './weight'

export interface WarmupSet {
  reps: number
  weight_kg: number
}

// Festes Schema: leere Stange, dann 40 / 60 / 80 % des Arbeitsgewichts
const STAGES = [
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 2 },
] as const

/**
 * Aufwärmsätze zum Arbeitsgewicht. Mit Stange beginnt das Schema mit der leeren Stange × 10;
 * Stufen unter der Stange, ab dem Arbeitsgewicht oder ohne Steigerung zur Vorstufe entfallen.
 */
export function warmupSets(work: number, bar: number | null, step: number): WarmupSet[] {
  const floor = bar ?? 0
  if (work <= floor) return []
  const result: WarmupSet[] = bar != null ? [{ reps: 10, weight_kg: bar }] : []
  for (const { pct, reps } of STAGES) {
    const weight = roundToStep(work * pct, step)
    const prev = result.at(-1)?.weight_kg ?? 0
    if (weight <= floor || weight <= prev || weight >= work) continue
    result.push({ reps, weight_kg: weight })
  }
  return result
}
