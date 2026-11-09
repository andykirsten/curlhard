const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

/** Der Deload-Hinweis bleibt nach „Ausblenden“ sieben Tage weg. */
export function isDeloadDismissed(dismissedAt: number | null, now: number): boolean {
  return dismissedAt != null && now - dismissedAt < DISMISS_MS
}

/** „A“, „A und B“, „A, B und C“, ab vier Übungen „A, B und 2 weitere“. */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`
  return `${names.slice(0, 2).join(', ')} und ${names.length - 2} weitere`
}
