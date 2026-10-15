import { useEffect, useRef } from 'react'
import type { LastSet, SetRead } from '@/api'
import { Badge } from '@/components/ui/card'
import { deltaLabel } from '@/lib/workout'
import { formatWeight } from '@/lib/weight'

export interface ActiveRow {
  number: number
  reps: number
  weight_kg: number
  is_warmup: boolean
  prev: LastSet | undefined
}

function valueLabel(reps: number, weight: number, loadType: string): string {
  return loadType === 'time' ? `${reps} s` : `${reps} × ${formatWeight(weight)} kg`
}

/**
 * Satz-Tabelle: Satz · Letztes Mal · Heute · Δ. Mit aktiver Zeile (nächster Satz),
 * deren Werte das Eingabe-Dock live spiegelt. Zeigt standardmäßig die letzten Zeilen,
 * ältere sind per Scrollen erreichbar.
 */
export function SetTable({
  sets,
  prevSets,
  active,
  loadType,
  recordsBySet,
  compact,
  onSelect,
}: {
  sets: SetRead[]
  /** Arbeitssätze des letzten Mals, Index = Nummer des Arbeitssatzes - 1 */
  prevSets: LastSet[]
  active: ActiveRow | null
  loadType: string
  recordsBySet: Record<number, number[]>
  /** Auf ~3 Zeilen begrenzen und ans Ende scrollen (laufende Session) */
  compact: boolean
  onSelect: (set: SetRead) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLLIElement>(null)
  // Kompakt: aktive Zeile unten ins Bild holen, darunter liegende Geisterzeilen bleiben scrollbar
  useEffect(() => {
    const el = scroller.current
    if (!el || !compact) return
    const row = activeRef.current
    el.scrollTop = row
      ? Math.max(0, row.offsetTop + row.offsetHeight - el.clientHeight)
      : el.scrollHeight
  }, [sets.length, compact])

  let working = 0
  const rows = sets.map((s) => {
    const number = s.is_warmup ? null : ++working
    return { s, number, prev: s.is_warmup ? undefined : prevSets[(number ?? 1) - 1] }
  })
  // Geisterzeilen: noch ausstehende Sätze vom letzten Mal (nur in laufender Session)
  const nextNumber = working + (active && !active.is_warmup ? 1 : 0)
  const ghosts = active
    ? prevSets.slice(nextNumber).map((prev, i) => ({ prev, number: nextNumber + i + 1 }))
    : []
  const grid =
    'grid grid-cols-[26px_minmax(0,1fr)_minmax(0,1.2fr)_56px] items-center gap-2 sm:grid-cols-[30px_1fr_1fr_86px]'

  return (
    <div>
      <div
        className={`${grid} pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground`}
      >
        <span>Satz</span>
        <span>Letztes Mal</span>
        <span>Heute</span>
        <span className="text-right">Δ</span>
      </div>
      <div
        ref={scroller}
        className={compact ? 'relative max-h-[11.5rem] overflow-y-auto' : undefined}
        data-testid="set-table"
      >
        <ul>
          {rows.map(({ s, number, prev }) => {
            const delta = deltaLabel(s, prev, loadType)
            const records = recordsBySet[s.id] ?? []
            return (
              <li key={s.id} data-testid="set-row" className="border-t">
                <button
                  type="button"
                  aria-label={`Satz ${number ?? 'Aufwärmen'} bearbeiten`}
                  className={`${grid} w-full py-[7px] text-left`}
                  onClick={() => onSelect(s)}
                >
                  <span className="font-display text-lg text-muted-foreground">
                    {number ?? 'W'}
                  </span>
                  <span className="text-base font-medium tabular-nums text-muted-foreground">
                    {prev ? valueLabel(prev.reps, prev.weight_kg, loadType) : '–'}
                  </span>
                  <span className="whitespace-nowrap font-display text-[19px] tabular-nums sm:text-[21px]">
                    {valueLabel(s.reps, s.weight_kg, loadType)}
                  </span>
                  <span
                    className={`text-right text-[13px] font-extrabold tabular-nums ${
                      delta.up ? 'text-primary' : 'text-muted-foreground'
                    }`}
                    aria-label="Veränderung ggü. letztem Mal"
                  >
                    {delta.text}
                  </span>
                </button>
                {records.length > 0 && (
                  <div className="pb-1.5 pl-[38px]">
                    <Badge variant="record" aria-label="Neuer Rekord">
                      Rekord {records.map((n) => `${n}RM`).join(' · ')}
                    </Badge>
                  </div>
                )}
              </li>
            )
          })}
          {active && (
            <li
              ref={activeRef}
              className="border-t pt-1"
              data-testid="active-row"
              aria-label="Nächster Satz"
            >
              <div
                className={`${grid} rounded-[10px] border-2 border-dashed border-primary py-[5px] pl-1.5 pr-1.5`}
              >
                <span className="font-display text-lg text-primary">
                  {active.is_warmup ? 'W' : active.number}
                </span>
                <span className="text-base font-medium tabular-nums text-muted-foreground">
                  {active.prev
                    ? valueLabel(active.prev.reps, active.prev.weight_kg, loadType)
                    : '–'}
                </span>
                <span className="whitespace-nowrap font-display text-[19px] tabular-nums sm:text-[21px] text-primary">
                  {valueLabel(active.reps, active.weight_kg, loadType)}
                </span>
                <span className="text-right text-[13px] font-extrabold uppercase text-primary">
                  jetzt
                </span>
              </div>
            </li>
          )}
          {ghosts.map(({ prev, number }) => (
            <li
              key={`ghost-${number}`}
              data-testid="ghost-row"
              aria-label={`Satz ${number}, letztes Mal ${valueLabel(prev.reps, prev.weight_kg, loadType)}`}
              className={`${grid} border-t py-[7px] opacity-50`}
            >
              <span className="font-display text-lg text-muted-foreground">{number}</span>
              <span className="text-base font-medium tabular-nums text-muted-foreground">
                {valueLabel(prev.reps, prev.weight_kg, loadType)}
              </span>
              <span className="font-display text-[21px] text-muted-foreground">–</span>
              <span />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
