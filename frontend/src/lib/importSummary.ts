import type { ImportResult } from '@/api'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Zeilen für die Import-Vorschau („12 Trainings, 340 Sätze“ …); Zähler mit 0 entfallen. */
export function importLines(r: ImportResult): string[] {
  const lines = [`${plural(r.sessions, 'Training', 'Trainings')}, ${plural(r.sets, 'Satz', 'Sätze')}`]
  const created = r.exercises_created
  if (created > 0)
    lines.push(created === 1 ? '1 neue Übung wird angelegt' : `${created} neue Übungen werden angelegt`)
  const known = r.sessions_skipped
  if (known > 0)
    lines.push(
      known === 1
        ? '1 Training ist schon vorhanden und wird übersprungen'
        : `${known} Trainings sind schon vorhanden und werden übersprungen`,
    )
  const rows = r.rows_skipped
  if (rows > 0)
    lines.push(
      `${rows === 1 ? '1 Zeile wird' : `${rows} Zeilen werden`} übersprungen (ohne Wiederholungen oder unplausibel)`,
    )
  return lines
}
