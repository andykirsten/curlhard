import { describe, expect, it } from 'vitest'
import {
  buildWeek,
  dayKicker,
  dayMark,
  msUntilNextDay,
  planByWeekday,
  splitDayName,
  weekdayShort,
  weekRangeLabel,
} from './week'

// Montag, 12. Oktober 2026, kurz nach Mitternacht (lokale Zeit)
const MONDAY = new Date(2026, 9, 12, 0, 30)
const PLAN = planByWeekday([
  { id: 1, name: 'Ganzkörper B', weekdays: [2] },
  { id: 2, name: 'Ganzkörper C', weekdays: [4] },
  { id: 3, name: 'Ganzkörper A', weekdays: [6] },
  { id: 4, name: 'Zusatz', weekdays: [2] },
  { id: 5, name: 'Frei', weekdays: [] },
])

describe('week', () => {
  it('maps plan days to weekdays, first one wins', () => {
    expect(PLAN[2]?.id).toBe(1)
    expect(Object.keys(PLAN)).toEqual(['2', '4', '6'])
  })

  it('maps one plan day to several weekdays', () => {
    const plan = planByWeekday([{ id: 7, name: 'Ganzkörper', weekdays: [0, 2, 4] }])
    expect(Object.keys(plan)).toEqual(['0', '2', '4'])
    expect(plan[4]?.id).toBe(7)
  })

  it('builds exactly 7 days starting at local start of today', () => {
    const week = buildWeek(MONDAY, PLAN, false)
    expect(week).toHaveLength(7)
    expect(week[0]!.date).toEqual(new Date(2026, 9, 12))
    expect(week[6]!.date).toEqual(new Date(2026, 9, 18))
    expect(week.map((d) => d.status)).toEqual([
      'today',
      'rest',
      'planned',
      'rest',
      'planned',
      'rest',
      'planned',
    ])
    expect(week.map(dayMark)).toEqual(['–', '·', 'B', '·', 'C', '·', 'A'])
    expect(week.map(weekdayShort)).toEqual(['Heute', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
  })

  it('rolls over months', () => {
    const week = buildWeek(new Date(2026, 9, 28, 23, 59), PLAN, false)
    expect(weekRangeLabel(week)).toBe('28. Okt – 3. Nov')
  })

  it('marks today as done only with a planned day', () => {
    const wed = new Date(2026, 9, 14, 18)
    expect(buildWeek(wed, PLAN, true)[0]!.status).toBe('done')
    expect(dayMark(buildWeek(wed, PLAN, true)[0]!)).toBe('✓')
    expect(buildWeek(MONDAY, PLAN, true)[0]!.status).toBe('today')
  })

  it('labels the selected day', () => {
    const week = buildWeek(MONDAY, PLAN, false)
    expect(dayKicker(week[0]!)).toBe('Heute · Montag, 12. Oktober')
    expect(dayKicker(week[1]!)).toBe('Morgen · Dienstag, 13. Oktober')
    expect(dayKicker(week[2]!)).toBe('In 2 Tagen · Mittwoch, 14. Oktober')
  })

  it('splits trailing training letters off day names', () => {
    expect(splitDayName('Ganzkörper B')).toEqual({ title: 'Ganzkörper', letter: 'B' })
    expect(splitDayName('Push')).toEqual({ title: 'Push', letter: '' })
    expect(
      dayMark({
        ...buildWeek(MONDAY, {}, false)[1]!,
        plan: { id: 9, name: 'push' },
        status: 'planned',
      }),
    ).toBe('P')
  })

  it('computes the time until the next local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 9, 12, 23, 59, 30))).toBe(30_000)
  })
})
