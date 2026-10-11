import { describe, expect, it } from 'vitest'
import { apiWeekday, durationLabel, formatShortDate, parseApiDate, weekdayLabel } from './dates'

describe('dates', () => {
  it('maps JS weekdays to API weekdays (Mo=0)', () => {
    expect(apiWeekday(new Date(2026, 9, 12))).toBe(0) // Montag
    expect(apiWeekday(new Date(2026, 9, 11))).toBe(6) // Sonntag
  })

  it('labels weekdays', () => {
    expect(weekdayLabel(0)).toBe('Montag')
    expect(weekdayLabel(null)).toBe('Frei wählbar')
  })

  it('treats API timestamps without zone as UTC', () => {
    expect(parseApiDate('2026-10-10T10:00:00').toISOString()).toBe('2026-10-10T10:00:00.000Z')
    expect(parseApiDate('2026-10-10T10:00:00+02:00').toISOString()).toBe('2026-10-10T08:00:00.000Z')
  })

  it('formats short dates', () => {
    expect(formatShortDate('2026-10-10T12:00:00Z')).toMatch(/^\d{1,2}\.\d{1,2}\.$/)
  })

  it('formats durations', () => {
    expect(durationLabel('2026-10-10T10:00:00Z', '2026-10-10T10:45:00Z')).toBe('45 min')
    expect(durationLabel('2026-10-10T10:00:00Z', '2026-10-10T11:20:00Z')).toBe('1 h 20 min')
    expect(durationLabel('2026-10-10T10:00:00Z', null)).toBe('läuft')
  })
})
