import { describe, expect, it } from 'vitest'
import { isDeloadDismissed, joinNames } from './deload'

const DAY = 24 * 60 * 60 * 1000

describe('isDeloadDismissed', () => {
  it('blendet sieben Tage lang aus, danach wieder ein', () => {
    const now = 100 * DAY
    expect(isDeloadDismissed(null, now)).toBe(false)
    expect(isDeloadDismissed(now - 6 * DAY, now)).toBe(true)
    expect(isDeloadDismissed(now - 7 * DAY, now)).toBe(false)
  })
})

describe('joinNames', () => {
  it('formuliert Aufzählungen auf Deutsch', () => {
    expect(joinNames(['Bankdrücken'])).toBe('Bankdrücken')
    expect(joinNames(['Bankdrücken', 'Rudern'])).toBe('Bankdrücken und Rudern')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B und C')
    expect(joinNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B und 3 weitere')
  })
})
