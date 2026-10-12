import { describe, expect, it } from 'vitest'
import { deltaLabel, e1rm, exerciseVolume, formatElapsed, volumePercent } from './workout'

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
