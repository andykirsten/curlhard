import { describe, expect, it } from 'vitest'
import { formatWeight, parseWeight, roundToStep, stepWeight } from './weight'

describe('weight', () => {
  it('rounds to the nearest step', () => {
    expect(roundToStep(61.3, 1.25)).toBe(61.25)
    expect(roundToStep(62, 2.5)).toBe(62.5)
    expect(roundToStep(0.4, 2.5)).toBe(0)
  })

  it('steps up and down by the configured step', () => {
    expect(stepWeight(60, 1, 2.5)).toBe(62.5)
    expect(stepWeight(60, -1, 1.25)).toBe(58.75)
  })

  it('never goes below zero', () => {
    expect(stepWeight(1, -1, 2.5)).toBe(0)
    expect(stepWeight(0, -1, 2.5)).toBe(0)
  })

  it('avoids floating point drift', () => {
    let w = 0
    for (let i = 0; i < 40; i++) w = stepWeight(w, 1, 1.25)
    expect(w).toBe(50)
  })

  it('formats with German decimal comma and no trailing zeros', () => {
    expect(formatWeight(62.5)).toBe('62,5')
    expect(formatWeight(60)).toBe('60')
    expect(formatWeight(61.25)).toBe('61,25')
  })

  it('parses comma and dot input', () => {
    expect(parseWeight('62,5')).toBe(62.5)
    expect(parseWeight('62.5')).toBe(62.5)
    expect(parseWeight(' 80 ')).toBe(80)
  })

  it('returns null for invalid input', () => {
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('abc')).toBeNull()
    expect(parseWeight('-5')).toBeNull()
  })
})
