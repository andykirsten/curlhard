const DAY_MS = 24 * 60 * 60 * 1000

/** Wandelt ein ISO-Datum (YYYY-MM-DD) in einen UTC-Zeitstempel ohne Zeitzonen-Verschiebung. */
function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** Datum als ISO-String in lokaler Zeit (YYYY-MM-DD), nicht in UTC. */
export function localIsoDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Heutiges Datum als ISO-String in lokaler Zeit (YYYY-MM-DD). */
export function todayIso(now: Date = new Date()): string {
  return localIsoDate(now)
}

/** Aktuelle Woche eines Zyklus (ab 1). Vor dem Start wird Woche 1 angezeigt. */
export function cycleWeek(startDate: string, today: string = todayIso()): number {
  const days = Math.floor((utcDay(today) - utcDay(startDate)) / DAY_MS)
  return Math.max(1, Math.floor(days / 7) + 1)
}

/** Gesamtzahl der Wochen eines Zyklus, oder null wenn kein Enddatum gesetzt ist. */
export function cycleTotalWeeks(startDate: string, endDate: string | null): number | null {
  if (!endDate) return null
  const days = Math.round((utcDay(endDate) - utcDay(startDate)) / DAY_MS) + 1
  return Math.max(1, Math.ceil(days / 7))
}

/** Anzeige für den Wochenstand, z. B. „Woche 3“ oder „Woche 3 von 6“. */
export function cycleWeekLabel(startDate: string, endDate: string | null, today?: string): string {
  const week = cycleWeek(startDate, today)
  const total = cycleTotalWeeks(startDate, endDate)
  return total ? `Woche ${week} von ${total}` : `Woche ${week}`
}
