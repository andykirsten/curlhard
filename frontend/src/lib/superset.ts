/** Ein Supersatz ist ein Lauf aufeinanderfolgender Übungen mit gleicher, gesetzter `group_no`. */
export interface Grouped {
  group_no?: number | null
}

export interface GroupInfo {
  /** Buchstabe der Gruppe in Reihenfolge der Läufe: A, B, … */
  letter: string
  /** 1-basierte Position in der Gruppe */
  pos: number
  size: number
}

/** Je Eintrag die Gruppe, zu der er gehört, oder null. Läufe aus nur einem Eintrag zählen nicht. */
export function groupRuns(items: Grouped[]): (GroupInfo | null)[] {
  const out: (GroupInfo | null)[] = items.map(() => null)
  let letter = 0
  for (let i = 0; i < items.length; ) {
    const g = items[i]!.group_no ?? null
    let j = i + 1
    while (g != null && j < items.length && items[j]!.group_no === g) j++
    if (g != null && j - i >= 2) {
      for (let k = i; k < j; k++) {
        out[k] = { letter: String.fromCharCode(65 + (letter % 26)), pos: k - i + 1, size: j - i }
      }
      letter++
    }
    i = j
  }
  return out
}

export interface GroupChange {
  id: number
  group_no: number | null
}

/**
 * Verbindet Eintrag `index` mit dem nächsten zu einem Supersatz oder löst die Verbindung.
 * Gibt nur die Einträge zurück, deren `group_no` sich ändert.
 */
export function toggleLink(items: (Grouped & { id: number })[], index: number): GroupChange[] {
  const a = items[index]
  const b = items[index + 1]
  if (!a || !b) return []
  const max = Math.max(0, ...items.map((i) => i.group_no ?? 0))
  const changes: GroupChange[] = []
  if (a.group_no != null && a.group_no === b.group_no) {
    // Lösen: der hintere Teil bekommt eine neue Nummer (oder null, wenn er allein bleibt)
    const rest: typeof items = []
    for (let i = index + 1; i < items.length && items[i]!.group_no === a.group_no; i++) {
      rest.push(items[i]!)
    }
    const next = rest.length >= 2 ? max + 1 : null
    for (const r of rest) changes.push({ id: r.id, group_no: next })
    const front = items.slice(0, index + 1).filter((i) => i.group_no === a.group_no)
    if (front.length === 1) changes.push({ id: a.id, group_no: null })
    return changes
  }
  const g = a.group_no ?? b.group_no ?? max + 1
  if (a.group_no !== g) changes.push({ id: a.id, group_no: g })
  if (b.group_no !== g) changes.push({ id: b.id, group_no: g })
  return changes
}
