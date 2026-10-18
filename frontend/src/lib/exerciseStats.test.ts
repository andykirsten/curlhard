import { describe, expect, it } from 'vitest'
import {
  buildHeatmap,
  formatSeconds,
  formatTonnage,
  groupByMonth,
  prLabel,
  prTarget,
  sparklinePath,
} from './exerciseStats'

const profile = [
  { reps: 5, actual_kg: 100, estimated_kg: 100.2 },
  { reps: 8, actual_kg: 80, estimated_kg: 86.1 },
  { reps: 12, actual_kg: null, estimated_kg: 72.4 },
  { reps: 13, actual_kg: 60, estimated_kg: 0 },
]

describe('prTarget', () => {
  it('liegt einen Schritt über dem Bestwert, wenn Schätzung und Bestwert gleichauf sind', () => {
    expect(prTarget(profile, 5, 2.5)).toEqual({ reps: 5, weight: 102.5, current: 100 })
  })

  it('nimmt die gerundete Schätzung, wenn der Bestwert deutlich darunter liegt', () => {
    expect(prTarget(profile, 8, 2.5)).toEqual({ reps: 8, weight: 85, current: 80 })
  })

  it('nutzt ohne Bestwert die gerundete Schätzung', () => {
    expect(prTarget(profile, 12, 2.5)).toEqual({ reps: 12, weight: 72.5, current: null })
  })

  it('rundet auf den eingestellten Schritt', () => {
    expect(prTarget(profile, 8, 1.25)?.weight).toBe(86.25)
  })

  it('liefert null ohne Schätzung oder unbekannte Wiederholungszahl', () => {
    expect(prTarget(profile, 13, 2.5)).toBeNull()
    expect(prTarget(profile, 3, 2.5)).toBeNull()
    expect(prTarget([], 5, 2.5)).toBeNull()
  })
})

describe('buildHeatmap', () => {
  // Mittwoch, 14.10.2026
  const now = new Date(2026, 9, 14, 12)

  it('erzeugt 26 Wochenspalten mit je 7 Tagen, Wochen beginnen am Montag', () => {
    const { columns } = buildHeatmap([], now)
    expect(columns).toHaveLength(26)
    expect(columns.every((c) => c.length === 7)).toBe(true)
    expect(columns[25]![0]!.key).toBe('2026-10-12')
    expect(columns[0]![0]!.key).toBe('2026-04-20')
  })

  it('lässt Tage nach heute leer', () => {
    const last = buildHeatmap([], now).columns[25]!
    expect(last[2]!.key).toBe('2026-10-14')
    expect(last[3]!.key).toBeNull()
    expect(last[6]!.key).toBeNull()
  })

  it('markiert Trainingstage und zählt Wochen mit Training', () => {
    const { columns, trainedWeeks } = buildHeatmap(
      ['2026-10-12', '2026-10-13', '2026-10-05', '2020-01-01'],
      now,
    )
    expect(columns[25]![0]).toEqual({ key: '2026-10-12', count: 1, level: 1 })
    expect(columns[25]![2]!.level).toBe(0)
    expect(columns[24]![0]!.level).toBe(1)
    expect(trainedWeeks).toBe(2)
  })
})

describe('groupByMonth', () => {
  it('gruppiert aufeinanderfolgende Einträge je Monat', () => {
    const groups = groupByMonth(
      [{ d: '2026-10-12T10:00:00Z' }, { d: '2026-10-02T10:00:00Z' }, { d: '2026-09-20T10:00:00Z' }],
      (x) => x.d,
    )
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ['2026-10', 2],
      ['2026-09', 1],
    ])
    expect(groups[0]!.label).toBe('Oktober 2026')
  })

  it('liefert für leere Eingabe eine leere Liste', () => {
    expect(groupByMonth([], () => '')).toEqual([])
  })
})

describe('Formatierung', () => {
  it('Tonnage in t und kg', () => {
    expect(formatTonnage(42300)).toBe('42,3 t')
    expect(formatTonnage(850)).toBe('850 kg')
  })

  it('Sekunden', () => {
    expect(formatSeconds(45)).toBe('45 s')
    expect(formatSeconds(90)).toBe('1:30 min')
  })

  it('PR-Beschriftung', () => {
    expect(prLabel('e1rm', null)).toBe('Neues e1RM-Hoch')
    expect(prLabel('nrm', 8)).toBe('Neuer 8RM')
    expect(prLabel('nrm', 1)).toBe('Neues 1RM')
  })
})

describe('sparklinePath', () => {
  it('ist leer ohne Werte', () => {
    expect(sparklinePath([null, null], 100, 20)).toEqual({ line: '', area: '', last: null })
  })

  it('zeichnet steigende Werte von links unten nach rechts oben', () => {
    const { line, last } = sparklinePath([1, 2, 3], 100, 30, 0)
    expect(line).toBe('M0.0 30.0 L50.0 15.0 L100.0 0.0')
    expect(last).toEqual([100, 0])
  })

  it('überspringt Lücken', () => {
    const { line } = sparklinePath([1, null, 3], 100, 30, 0)
    expect(line).toBe('M0.0 30.0 L100.0 0.0')
  })
})
