import { describe, expect, it } from 'vitest'
import { DEFAULT_PLATES, plateLoad, plateSummary } from './plates'

describe('plateLoad', () => {
  it('lädt Kniebeuge mit 20-kg-Stange', () => {
    expect(plateLoad(100, 20, DEFAULT_PLATES)).toEqual({
      perSide: [25, 15],
      achieved: 100,
      exact: true,
    })
  })

  it('rechnet mit SZ-Stange und kleinen Scheiben', () => {
    expect(plateLoad(32.5, 10, DEFAULT_PLATES)).toEqual({
      perSide: [10, 1.25],
      achieved: 32.5,
      exact: true,
    })
  })

  it('leere Stange braucht keine Scheiben', () => {
    expect(plateLoad(20, 20, DEFAULT_PLATES)).toEqual({ perSide: [], achieved: 20, exact: true })
  })

  it('ist ohne Stange (0 kg) nutzbar, z. B. Beinpresse', () => {
    expect(plateLoad(90, 0, DEFAULT_PLATES)?.perSide).toEqual([25, 20])
  })

  it('findet die kleinste Scheibenzahl, wo Gier scheitern würde', () => {
    // 20 kg pro Seite nur aus 15ern und 10ern: 10 + 10 statt 15 + Rest
    expect(plateLoad(60, 20, [15, 10])).toEqual({ perSide: [10, 10], achieved: 60, exact: true })
  })

  it('liefert das nächst leichtere Gewicht, wenn das Ziel nicht ladbar ist', () => {
    expect(plateLoad(61, 20, DEFAULT_PLATES)).toEqual({
      perSide: [20],
      achieved: 60,
      exact: false,
    })
    expect(plateLoad(50, 20, [20])).toEqual({ perSide: [], achieved: 20, exact: false })
  })

  it('ist null unterhalb der Stange', () => {
    expect(plateLoad(15, 20, DEFAULT_PLATES)).toBeNull()
  })
})

describe('plateSummary', () => {
  it('fasst Stange und Scheiben pro Seite zusammen', () => {
    expect(plateSummary(20, plateLoad(102.5, 20, DEFAULT_PLATES))).toBe(
      'Stange 20 · je Seite 25 + 15 + 1,25',
    )
    expect(plateSummary(20, plateLoad(20, 20, DEFAULT_PLATES))).toBe('Stange 20 · je Seite leer')
    expect(plateSummary(20, plateLoad(61, 20, DEFAULT_PLATES))).toBe('Stange 20 · je Seite 20 ≈')
    expect(plateSummary(20, null)).toBe('Leichter als die Stange (20 kg)')
  })
})
