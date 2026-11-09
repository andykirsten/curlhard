import { describe, expect, it } from 'vitest'
import { changeSince, formatChange } from './bodyWeight'

const TODAY = new Date(2026, 10, 9) // 9. Nov 2026
const e = (measured_on: string, weight_kg: number) => ({ measured_on, weight_kg })

describe('changeSince', () => {
  it('vergleicht mit dem letzten Eintrag am oder vor dem Stichtag', () => {
    const entries = [e('2026-09-01', 82), e('2026-10-12', 80), e('2026-11-01', 79.5), e('2026-11-09', 79)]
    // 28 Tage vor dem 9.11. = 12.10.
    expect(changeSince(entries, 28, TODAY)).toBe(-1)
  })

  it('gibt null zurück, wenn es keinen so alten Eintrag gibt', () => {
    expect(changeSince([e('2026-11-05', 80), e('2026-11-09', 79)], 28, TODAY)).toBeNull()
    expect(changeSince([], 28, TODAY)).toBeNull()
  })

  it('rundet auf 0,1 kg', () => {
    expect(changeSince([e('2026-10-01', 80.04), e('2026-11-09', 80.31)], 28, TODAY)).toBe(0.3)
  })
})

describe('formatChange', () => {
  it('zeigt Vorzeichen und deutsches Komma', () => {
    expect(formatChange(0.5)).toBe('+0,5 kg')
    expect(formatChange(-1.2)).toBe('−1,2 kg')
    expect(formatChange(2)).toBe('+2 kg')
    expect(formatChange(0)).toBe('±0 kg')
  })
})
