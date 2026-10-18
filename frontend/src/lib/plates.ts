import { formatWeight } from './weight'

/** Scheiben, die in den Einstellungen auswählbar sind (kg, absteigend). */
export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5] as const

export const DEFAULT_PLATES: number[] = [25, 20, 15, 10, 5, 2.5, 1.25]

export interface PlateLoad {
  /** Scheiben pro Seite, absteigend */
  perSide: number[]
  /** Gesamtgewicht mit diesen Scheiben (inkl. Stange) */
  achieved: number
  /** true, wenn das Zielgewicht genau erreicht wird */
  exact: boolean
}

// In Hundertstel-Kilo rechnen, damit 1,25 kg & Co. ohne Rundungsfehler aufgehen
const toUnits = (kg: number) => Math.round(kg * 100)

/**
 * Scheiben pro Seite für ein Gesamtgewicht (inkl. Stange). Jede ausgewählte Scheibe gilt als
 * beliebig oft vorhanden. Ist das Ziel nicht genau ladbar, liefert die Funktion das nächst
 * leichtere ladbare Gewicht, jeweils mit möglichst wenigen Scheiben. `null`, wenn das Ziel
 * leichter als die Stange ist.
 */
export function plateLoad(total: number, bar: number, plates: readonly number[]): PlateLoad | null {
  if (total < bar) return null
  const target = Math.floor((toUnits(total) - toUnits(bar)) / 2)
  const units = [...new Set(plates.map(toUnits).filter((p) => p > 0))].sort((a, b) => b - a)
  // fewest[a] = minimale Scheibenzahl für a Hundertstel pro Seite, last[a] = zuletzt gelegte Scheibe
  const fewest: number[] = [0]
  const last: number[] = [0]
  for (let a = 1; a <= target; a++) {
    let best = Infinity
    let plate = 0
    for (const p of units) {
      const rest = p <= a ? (fewest[a - p] ?? Infinity) : Infinity
      if (rest + 1 < best) {
        best = rest + 1
        plate = p
      }
    }
    fewest.push(best)
    last.push(plate)
  }
  let reach = target
  while (reach > 0 && fewest[reach] === Infinity) reach--
  const perSide: number[] = []
  for (let a = reach; a > 0; ) {
    const p = last[a] ?? a
    perSide.push(p / 100)
    a -= p
  }
  perSide.sort((x, y) => y - x)
  const achieved = (toUnits(bar) + 2 * reach) / 100
  return { perSide, achieved, exact: toUnits(achieved) === toUnits(total) }
}

/** Kurzform für das Eingabe-Dock, z. B. „Stange 20 · je Seite 25 + 15“. */
export function plateSummary(bar: number, load: PlateLoad | null): string {
  if (!load) return `Leichter als die Stange (${formatWeight(bar)} kg)`
  const side = load.perSide.length > 0 ? load.perSide.map(formatWeight).join(' + ') : 'leer'
  return `Stange ${formatWeight(bar)} · je Seite ${side}${load.exact ? '' : ' ≈'}`
}
