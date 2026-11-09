import { describe, expect, it } from 'vitest'
import { balanceStatus, barPercent, formatSets, scaleMax, STATUS_LABEL } from './balance'

describe('balanceStatus', () => {
  it('trennt unter, im und über dem Zielbereich 10–20', () => {
    expect(balanceStatus(0)).toBe('low')
    expect(balanceStatus(9.9)).toBe('low')
    expect(balanceStatus(10)).toBe('ok')
    expect(balanceStatus(20)).toBe('ok')
    expect(balanceStatus(20.1)).toBe('high')
  })

  it('hat zu jedem Status einen lesbaren Text', () => {
    expect(STATUS_LABEL).toEqual({ low: 'unter 10', ok: 'im Bereich', high: 'über 20' })
  })
})

describe('Balken', () => {
  it('skaliert mindestens auf 25 und wächst mit großen Werten', () => {
    expect(scaleMax([])).toBe(25)
    expect(scaleMax([3, 12])).toBe(25)
    expect(scaleMax([31])).toBe(31)
  })

  it('begrenzt die Breite auf 0–100 %', () => {
    expect(barPercent(12.5, 25)).toBe(50)
    expect(barPercent(40, 25)).toBe(100)
    expect(barPercent(-1, 25)).toBe(0)
  })

  it('formatiert mit Komma', () => {
    expect(formatSets(12.5)).toBe('12,5')
    expect(formatSets(10)).toBe('10')
  })
})
