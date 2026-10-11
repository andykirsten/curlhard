import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

export const WEEKDAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
]
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** JS: So=0..Sa=6 -> API: Mo=0..So=6 */
export function apiWeekday(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7
}

export function weekdayLabel(weekday: number | null | undefined): string {
  return weekday == null ? 'Frei wählbar' : (WEEKDAYS[weekday] ?? '')
}

// Das Backend liefert ISO 8601 in UTC; Anzeige in lokaler Zeit.
export function parseApiDate(value: string): Date {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  return parseISO(hasZone ? value : `${value}Z`)
}

export function formatDate(value: string, pattern = 'EEE, d. MMM yyyy'): string {
  return format(parseApiDate(value), pattern, { locale: de })
}

export function formatDateTime(value: string): string {
  return format(parseApiDate(value), "EEE, d. MMM yyyy 'um' HH:mm", {
    locale: de,
  })
}

export function formatShortDate(value: string): string {
  return format(parseApiDate(value), 'd.M.', { locale: de })
}

export function timeAgo(value: string): string {
  return formatDistanceToNowStrict(parseApiDate(value), {
    locale: de,
    addSuffix: true,
  })
}

export function durationLabel(startIso: string, endIso: string | null): string {
  if (!endIso) return 'läuft'
  const mins = Math.max(
    0,
    Math.round((parseApiDate(endIso).getTime() - parseApiDate(startIso).getTime()) / 60000),
  )
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`
}
