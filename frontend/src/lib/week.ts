import { addDays, startOfDay } from 'date-fns'
import { apiWeekday, WEEKDAYS, WEEKDAYS_SHORT } from '@/lib/dates'

// Rollierende Wochenleiste auf „Heute“ (Design „Wochenleiste“): heute + die nächsten 6 Tage.
// Alle Datumswerte in lokaler Zeit, sonst springt der Tag zwischen 0 und 2 Uhr falsch.

export const WEEK_LENGTH = 7

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

export interface WeekPlanDay {
  id: number
  name: string
}

/** Plantag je Wochentag (Mo = 0). Später erweiterbar um Ausnahmen pro Datum. */
export type PlanByWeekday = Partial<Record<number, WeekPlanDay>>

export type WeekDayStatus = 'today' | 'done' | 'planned' | 'rest'

export interface WeekDay {
  index: number
  date: Date
  weekday: number
  plan: WeekPlanDay | null
  status: WeekDayStatus
}

/** Baut die 7 Tage ab dem lokalen Tagesbeginn von `now`. */
export function buildWeek(
  now: Date,
  planByWeekday: PlanByWeekday,
  completedToday: boolean,
): WeekDay[] {
  const start = startOfDay(now)
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const date = addDays(start, i)
    const weekday = apiWeekday(date)
    const plan = planByWeekday[weekday] ?? null
    const status: WeekDayStatus =
      i === 0 ? (plan && completedToday ? 'done' : 'today') : plan ? 'planned' : 'rest'
    return { index: i, date, weekday, plan, status }
  })
}

/** Ordnet Plantage ihren Wochentagen zu; bei mehreren Tagen pro Wochentag gewinnt der erste. */
export function planByWeekday(
  days: readonly { id: number; name: string; weekday: number | null }[],
): PlanByWeekday {
  const out: PlanByWeekday = {}
  for (const d of days) {
    if (d.weekday != null && out[d.weekday] == null) out[d.weekday] = { id: d.id, name: d.name }
  }
  return out
}

/** „Ganzkörper B“ → Titel „Ganzkörper“ + Buchstabe „B“; sonst ganzer Name ohne Buchstaben. */
export function splitDayName(name: string): { title: string; letter: string } {
  const m = /^(.*\S)\s+([A-Za-z])$/.exec(name.trim())
  return m ? { title: m[1]!, letter: m[2]!.toUpperCase() } : { title: name.trim(), letter: '' }
}

/** Markierung in der Kachel: Trainingsbuchstabe, sonst Anfangsbuchstabe des Tagesnamens. */
export function dayMark(day: WeekDay): string {
  if (day.status === 'done') return '✓'
  if (!day.plan) return day.status === 'today' ? '–' : '·'
  const { title, letter } = splitDayName(day.plan.name)
  return letter || title.charAt(0).toUpperCase() || '•'
}

export function weekdayShort(day: WeekDay): string {
  return day.index === 0 ? 'Heute' : (WEEKDAYS_SHORT[day.weekday] ?? '')
}

export function relativeDayLabel(index: number): string {
  return index === 0 ? 'Heute' : index === 1 ? 'Morgen' : `In ${index} Tagen`
}

/** „Heute · Montag, 12. Oktober“ */
export function dayKicker(day: WeekDay): string {
  return `${relativeDayLabel(day.index)} · ${longDate(day.date)}`
}

/** „Mittwoch, 14. Oktober“ */
export function longDate(date: Date): string {
  return `${WEEKDAYS[apiWeekday(date)]}, ${date.getDate()}. ${MONTHS[date.getMonth()]}`
}

/** „12. Okt – 18. Okt“ */
export function weekRangeLabel(week: readonly WeekDay[]): string {
  const short = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]!.slice(0, 3)}`
  const first = week[0]
  const last = week[week.length - 1]
  return first && last ? `${short(first.date)} – ${short(last.date)}` : ''
}

/** Millisekunden bis zur nächsten lokalen Mitternacht. */
export function msUntilNextDay(now: Date): number {
  return addDays(startOfDay(now), 1).getTime() - now.getTime()
}
