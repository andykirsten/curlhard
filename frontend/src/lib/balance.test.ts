import { describe, expect, it } from 'vitest'
import { balancePercent, formatSets, referenceSets } from './balance'

describe('referenceSets', () => {
  it('nimmt die höchste Wochensatzzahl als Referenz', () => {
    expect(referenceSets([2, 4, 1])).toBe(4)
    expect(referenceSets([])).toBe(0)
  })
})

describe('balancePercent', () => {
  it('setzt die Gruppen relativ zur am meisten trainierten (Bank 4 Sätze, Kniebeuge 2)', () => {
    const reference = referenceSets([4, 2])
    expect(balancePercent(4, reference)).toBe(100)
    expect(balancePercent(2, reference)).toBe(50)
    expect(balancePercent(0, reference)).toBe(0)
  })

  it('rundet auf ganze Prozent und liefert ohne Training 0', () => {
    expect(balancePercent(1, 3)).toBe(33)
    expect(balancePercent(0, 0)).toBe(0)
  })

  it('begrenzt auf 0–100 %', () => {
    expect(balancePercent(5, 4)).toBe(100)
    expect(balancePercent(-1, 4)).toBe(0)
  })
})

describe('formatSets', () => {
  it('formatiert mit Komma', () => {
    expect(formatSets(12.5)).toBe('12,5')
    expect(formatSets(10)).toBe('10')
  })
})
