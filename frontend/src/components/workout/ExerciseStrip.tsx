import { Plus } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { ExerciseProgress } from '@/lib/workout'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<ExerciseProgress['status'], string> = {
  done: 'border-transparent bg-primary text-primary-foreground',
  started: 'border-transparent bg-secondary text-foreground',
  open: 'border-border bg-transparent text-muted-foreground',
}

export interface ExerciseStripItem {
  id: number
  name: string
  progress: ExerciseProgress
}

interface ExerciseStripProps {
  items: ExerciseStripItem[]
  selected: number
  onSelect: (index: number) => void
  /** Ohne Handler (z. B. beendete Session) entfällt die „+“-Kachel */
  onAdd?: () => void
}

function progressText({ done, target, status }: ExerciseProgress): string {
  if (status === 'done') return '✓'
  return target != null ? `${done}/${target}` : String(done)
}

function progressLabel({ done, target }: ExerciseProgress): string {
  const sets =
    target != null ? `${done} von ${target} Sätzen` : `${done} ${done === 1 ? 'Satz' : 'Sätze'}`
  return target != null && done >= target ? `${sets}, erledigt` : sets
}

/** Übungs-Leiste der Session: eine Kachel je Übung, als Tabs bedienbar (←/→, Pos1/Ende). */
export function ExerciseStrip({ items, selected, onSelect, onAdd }: ExerciseStripProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  // Aktive Kachel mittig ins Bild holen – nur horizontal, damit die Seite nicht springt
  useEffect(() => {
    const box = scroller.current
    const el = refs.current[selected]
    if (!box || !el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    box.scrollTo?.({
      left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }, [selected, items.length])

  const select = (i: number) => {
    onSelect(i)
    refs.current[i]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const last = items.length - 1
    const next =
      e.key === 'ArrowRight'
        ? Math.min(last, selected + 1)
        : e.key === 'ArrowLeft'
          ? Math.max(0, selected - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (next == null) return
    e.preventDefault()
    select(next)
  }

  return (
    <div
      ref={scroller}
      className="no-scrollbar relative flex snap-x snap-proximity scroll-px-5 gap-[5px] overflow-x-auto px-5 py-1"
    >
      <div role="tablist" aria-label="Übungen" className="flex gap-[5px]" onKeyDown={onKeyDown}>
        {items.map((item, i) => {
          const isSelected = i === selected
          const { status } = item.progress
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              aria-label={`Übung ${i + 1}: ${item.name}, ${progressLabel(item.progress)}`}
              onClick={() => onSelect(i)}
              className={cn(
                'flex h-14 w-[68px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-[10px] border px-1 focus-visible:outline-none',
                STATUS_CLASS[status],
                isSelected &&
                  'shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_hsl(var(--foreground))]',
              )}
            >
              <span className="font-display text-[15px] leading-none">{i + 1}</span>
              <span className="w-full truncate text-center text-[10px] font-bold uppercase leading-none tracking-[0.06em]">
                {item.name}
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold leading-none tabular-nums',
                  status === 'started' ? 'text-primary' : 'opacity-75',
                )}
              >
                {progressText(item.progress)}
              </span>
            </button>
          )
        })}
      </div>
      {onAdd && (
        <button
          type="button"
          aria-label="Übung hinzufügen"
          onClick={onAdd}
          className="flex h-14 w-11 shrink-0 snap-start items-center justify-center rounded-[10px] border border-dashed border-border text-muted-foreground"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
