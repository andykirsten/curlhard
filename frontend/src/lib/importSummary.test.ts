import { describe, expect, it } from 'vitest'
import type { ImportResult } from '@/api'
import { importLines } from './importSummary'

const base: ImportResult = {
  dry_run: true,
  sessions: 12,
  sets: 340,
  exercises_created: 0,
  exercises_reused: 5,
  sessions_skipped: 0,
  rows_skipped: 0,
}

describe('importLines', () => {
  it('zeigt nur die Hauptzeile, wenn nichts übersprungen oder angelegt wird', () => {
    expect(importLines(base)).toEqual(['12 Trainings, 340 Sätze'])
  })

  it('ergänzt neue Übungen, vorhandene Trainings und übersprungene Zeilen (Plural)', () => {
    expect(
      importLines({ ...base, exercises_created: 4, sessions_skipped: 2, rows_skipped: 3 }),
    ).toEqual([
      '12 Trainings, 340 Sätze',
      '4 neue Übungen werden angelegt',
      '2 Trainings sind schon vorhanden und werden übersprungen',
      '3 Zeilen werden übersprungen (ohne Wiederholungen oder unplausibel)',
    ])
  })

  it('beugt auch den Singular richtig', () => {
    expect(
      importLines({
        ...base,
        sessions: 1,
        sets: 1,
        exercises_created: 1,
        sessions_skipped: 1,
        rows_skipped: 1,
      }),
    ).toEqual([
      '1 Training, 1 Satz',
      '1 neue Übung wird angelegt',
      '1 Training ist schon vorhanden und wird übersprungen',
      '1 Zeile wird übersprungen (ohne Wiederholungen oder unplausibel)',
    ])
  })
})
