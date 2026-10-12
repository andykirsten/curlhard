import { useRef, type KeyboardEvent } from 'react'
import { dayMark, longDate, weekdayShort, type WeekDay } from '@/lib/week'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<WeekDay['status'], string> = {
  today: 'border-transparent bg-primary text-primary-foreground',
  done: 'border-transparent bg-primary text-primary-foreground',
  planned: 'border-transparent bg-secondary text-foreground',
  rest: 'border-border bg-transparent text-muted-foreground',
}

interface WeekStripProps {
  week: WeekDay[]
  selected: number
  onSelect: (index: number) => void
}

/** Wochenleiste: 7 Kacheln ab heute, als Tabs bedienbar (←/→, Pos1/Ende). */
export function WeekStrip({ week, selected, onSelect }: WeekStripProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const select = (i: number) => {
    onSelect(i)
    refs.current[i]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const last = week.length - 1
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
      role="tablist"
      aria-label="Nächste 7 Tage"
      className="grid grid-cols-7 gap-[5px]"
      onKeyDown={onKeyDown}
    >
      {week.map((d) => {
        const isSelected = d.index === selected
        return (
          <button
            key={d.index}
            ref={(el) => {
              refs.current[d.index] = el
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            aria-label={`${longDate(d.date)}, ${d.plan ? d.plan.name : 'Ruhetag'}${d.status === 'done' ? ', erledigt' : ''}`}
            onClick={() => onSelect(d.index)}
            className={cn(
              'flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] border focus-visible:outline-none',
              STATUS_CLASS[d.status],
              isSelected &&
                'shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_hsl(var(--foreground))]',
            )}
          >
            <span className="text-[11px] font-bold uppercase leading-none tracking-[0.08em]">
              {weekdayShort(d)}
            </span>
            <span className="font-display text-[15px] leading-none">{dayMark(d)}</span>
            <span className="text-[10px] font-semibold leading-none opacity-75">
              {d.date.getDate()}.
            </span>
          </button>
        )
      })}
    </div>
  )
}
