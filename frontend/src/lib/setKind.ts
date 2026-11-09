/** Art eines Satzes in der Oberfläche; API: `is_warmup` (Aufwärmen) und `set_type` (Rest). */
export type SetType = 'normal' | 'drop' | 'backoff'
export type SetKind = 'normal' | 'warmup' | SetType

export const SET_KINDS: {
  value: SetKind
  /** Kurzer Name für Auswahlleisten */
  name: string
  label: string
  short: string
  hint: string
}[] = [
  { value: 'normal', name: 'Arbeit', label: 'Arbeitssatz', short: 'A', hint: 'zählt für e1RM und Rekorde' },
  { value: 'warmup', name: 'Aufwärmen', label: 'Aufwärmsatz', short: 'W', hint: 'zählt nicht mit' },
  { value: 'drop', name: 'Drop', label: 'Drop-Satz', short: 'D', hint: 'weniger Gewicht direkt danach, nur Volumen' },
  { value: 'backoff', name: 'Backoff', label: 'Backoff-Satz', short: 'B', hint: 'leichterer Zusatzsatz, nur Volumen' },
]

interface HasKind {
  is_warmup: boolean
  set_type?: string
}

export function kindOf(s: HasKind): SetKind {
  if (s.is_warmup) return 'warmup'
  return s.set_type === 'drop' || s.set_type === 'backoff' ? s.set_type : 'normal'
}

export function kindFields(kind: SetKind): { is_warmup: boolean; set_type: SetType } {
  return kind === 'warmup'
    ? { is_warmup: true, set_type: 'normal' }
    : { is_warmup: false, set_type: kind }
}

/** Kürzel für die Satztabelle („W“, „D“, „B“); null bei normalen Arbeitssätzen. */
export function kindMark(s: HasKind): string | null {
  const kind = kindOf(s)
  return kind === 'normal' ? null : SET_KINDS.find((k) => k.value === kind)!.short
}
