import { describe, expect, it } from 'vitest'
import {
  compareLabel,
  deltaLabel,
  e1rm,
  exerciseProgress,
  exerciseVolume,
  formatElapsed,
  volumePercent,
} from './workout'

const set = (reps: number, weight_kg: number, is_warmup = false) => ({ reps, weight_kg, is_warmup })

describe('e1rm', () => {
  it('uses Epley', () => {
    expect(e1rm(60, 6)).toBeCloseTo(72)
  })
})

describe('exerciseVolume / volumePercent', () => {
  it('ignores warmups', () => {
    expect(exerciseVolume([set(10, 20, true), set(8, 60), set(8, 60)])).toBe(960)
  })
  it('sums seconds for time exercises', () => {
    expect(exerciseVolume([set(30, 0), set(45, 0)], 'time')).toBe(75)
  })
  it('computes percent of last time, null without baseline', () => {
    expect(volumePercent(480, 960)).toBe(50)
    expect(volumePercent(1000, 0)).toBeNull()
  })
})

describe('exerciseProgress', () => {
  it('counts working sets against the plan target', () => {
    expect(exerciseProgress([], 3)).toEqual({ done: 0, target: 3, status: 'open' })
    expect(exerciseProgress([set(10, 20, true), set(8, 60)], 3)).toEqual({
      done: 1,
      target: 3,
      status: 'started',
    })
    expect(exerciseProgress([set(8, 60), set(8, 60), set(8, 60), set(6, 60)], 3).status).toBe('done')
  })
  it('is never done without a target', () => {
    expect(exerciseProgress([set(8, 60)])).toEqual({ done: 1, target: null, status: 'started' })
    expect(exerciseProgress([set(10, 20, true)], 0).status).toBe('open')
  })
})

describe('compareLabel', () => {
  const at = '2026-10-05T08:00:00Z'
  it('names the plan day or the fallback source', () => {
    expect(compareLabel({ source_started_at: at, same_plan_day: true }, 'Tag 2')).toBe(
      'Letztes Mal: Tag 2 · Mo, 05.10.',
    )
    expect(compareLabel({ source_started_at: at, same_plan_day: false }, 'Tag 2')).toBe(
      'Letztes Mal: anderes Training · Mo, 05.10.',
    )
  })
  it('handles missing history', () => {
    expect(compareLabel(undefined, null)).toBe('Noch kein Vergleich')
    expect(compareLabel({ source_started_at: null, same_plan_day: false }, null)).toBe(
      'Noch kein Vergleich',
    )
  })
})

describe('deltaLabel', () => {
  it('compares weight first', () => {
    expect(deltaLabel(set(8, 62.5), set(8, 60))).toEqual({ text: '▲ +2,5 kg', up: true })
    expect(deltaLabel(set(8, 57.5), set(8, 60))).toEqual({ text: '▼ −2,5 kg', up: false })
  })
  it('falls back to reps at equal weight', () => {
    expect(deltaLabel(set(9, 60), set(8, 60))).toEqual({ text: '▲ +1 Wdh', up: true })
    expect(deltaLabel(set(7, 60), set(8, 60))).toEqual({ text: '▼ −1 Wdh', up: false })
    expect(deltaLabel(set(8, 60), set(8, 60))).toEqual({ text: '= gleich', up: false })
  })
  it('handles missing baseline and warmups', () => {
    expect(deltaLabel(set(8, 60), undefined).text).toBe('neu')
    expect(deltaLabel(set(10, 20, true), set(8, 60)).text).toBe('Aufwärmen')
  })
  it('compares seconds for time exercises', () => {
    expect(deltaLabel(set(35, 0), set(30, 0), 'time').text).toBe('▲ +5 s')
  })
})

describe('formatElapsed', () => {
  it('formats hh:mm:ss', () => {
    expect(formatElapsed(3_723_000)).toBe('01:02:03')
    expect(formatElapsed(-5)).toBe('00:00:00')
  })
})
