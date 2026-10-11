import { describe, expect, it } from 'vitest'
import { endsAtFrom, formatClock, isFinished, remainingSeconds } from './timer'

describe('timer', () => {
  it('computes the end timestamp from now + duration', () => {
    expect(endsAtFrom(90, 1_000)).toBe(91_000)
  })

  it('derives remaining seconds from the stored end time (survives screen lock)', () => {
    const endsAt = endsAtFrom(90, 0)
    expect(remainingSeconds(endsAt, 30_000)).toBe(60)
    // App war 10 Minuten im Hintergrund
    expect(remainingSeconds(endsAt, 600_000)).toBe(0)
  })

  it('rounds partial seconds up so the display never shows 0 early', () => {
    expect(remainingSeconds(10_000, 9_200)).toBe(1)
    expect(remainingSeconds(10_000, 10_000)).toBe(0)
  })

  it('knows when it has finished', () => {
    expect(isFinished(5_000, 4_999)).toBe(false)
    expect(isFinished(5_000, 5_000)).toBe(true)
  })

  it('formats as m:ss', () => {
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(600)).toBe('10:00')
    expect(formatClock(-3)).toBe('0:00')
  })
})
