import { describe, expect, it } from 'vitest'
import { cycleTotalWeeks, cycleWeek, cycleWeekLabel, localIsoDate } from './cycle'

describe('cycle', () => {
  it('liefert das lokale Datum als YYYY-MM-DD', () => {
    expect(localIsoDate(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05')
    expect(localIsoDate(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09')
  })

  it('zählt Wochen ab Startdatum (ab 1)', () => {
    expect(cycleWeek('2026-10-05', '2026-10-05')).toBe(1)
    expect(cycleWeek('2026-10-05', '2026-10-11')).toBe(1)
    expect(cycleWeek('2026-10-05', '2026-10-12')).toBe(2)
    expect(cycleWeek('2026-10-05', '2026-10-26')).toBe(4)
  })

  it('zeigt Woche 1, wenn der Zyklus noch nicht begonnen hat', () => {
    expect(cycleWeek('2026-10-20', '2026-10-11')).toBe(1)
  })

  it('berechnet Gesamtwochen aus Start- und Enddatum', () => {
    expect(cycleTotalWeeks('2026-10-05', null)).toBeNull()
    expect(cycleTotalWeeks('2026-10-05', '2026-10-11')).toBe(1)
    expect(cycleTotalWeeks('2026-10-05', '2026-10-18')).toBe(2)
    expect(cycleTotalWeeks('2026-10-05', '2026-10-19')).toBe(3)
  })

  it('formatiert das Wochen-Label', () => {
    expect(cycleWeekLabel('2026-10-05', null, '2026-10-19')).toBe('Woche 3')
    expect(cycleWeekLabel('2026-10-05', '2026-11-01', '2026-10-19')).toBe('Woche 3 von 4')
  })
})
