import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { reorderIds } from '@/lib/reorder'
import { useSortSensors } from '@/lib/useSortSensors'
import type { ExerciseProgress } from '@/lib/workout'
import { cn } from '@/lib/utils'

const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP_PX = 8

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
  /** Editiermodus (Raster, Umsortieren, Entfernen); ohne `onEditStart` kein Long-Press */
  editing?: boolean
  onEditStart?: () => void
  onReorder?: (ids: number[]) => void
  onRemove?: (id: number) => void
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

function TileBody({ item, index }: { item: ExerciseStripItem; index: number }) {
  const { status } = item.progress
  return (
    <>
      <span className="font-display text-[15px] leading-none">{index + 1}</span>
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
    </>
  )
}

const TILE_CLASS =
  'flex h-14 w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border px-1'

function AddTile({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      aria-label="Übung hinzufügen"
      onClick={onAdd}
      className="flex h-14 w-11 shrink-0 snap-start items-center justify-center rounded-[10px] border border-dashed border-border text-muted-foreground"
    >
      <Plus className="h-5 w-5" />
    </button>
  )
}

function EditTile({
  item,
  index,
  onRemove,
}: {
  item: ExerciseStripItem
  index: number
  onRemove: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  return (
    <div
      ref={setNodeRef}
      className={cn('relative', isDragging && 'z-10')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Übung ${index + 1}: ${item.name}, zum Umsortieren ziehen`}
        style={{ animationDelay: `-${(index % 4) * 60}ms` }}
        className={cn(
          TILE_CLASS,
          'touch-none select-none',
          STATUS_CLASS[item.progress.status],
          isDragging
            ? 'scale-105 shadow-lg'
            : 'motion-safe:animate-[curlhard-wiggle_0.18s_ease-in-out_infinite_alternate]',
        )}
      >
        <TileBody item={item} index={index} />
      </div>
      <button
        type="button"
        aria-label={`Übung entfernen: ${item.name}`}
        onClick={() => onRemove(item.id)}
        className="absolute -left-[18px] -top-[18px] z-10 flex h-11 w-11 items-center justify-center"
      >
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
          <Minus className="h-4 w-4" strokeWidth={3} />
        </span>
      </button>
    </div>
  )
}

/** Übungs-Leiste der Session: eine Kachel je Übung, als Tabs bedienbar (←/→, Pos1/Ende). */
export function ExerciseStrip({
  items,
  selected,
  onSelect,
  onAdd,
  editing,
  onEditStart,
  onReorder,
  onRemove,
}: ExerciseStripProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const sensors = useSortSensors()
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }
  const startPress = (e: PointerEvent) => {
    if (!onEditStart) return
    cancelPress()
    press.current = {
      timer: window.setTimeout(() => {
        press.current = null
        onEditStart()
      }, LONG_PRESS_MS),
      x: e.clientX,
      y: e.clientY,
    }
  }
  // Scrollen der Leiste darf keinen Editiermodus auslösen
  const movePress = (e: PointerEvent) => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP_PX) cancelPress()
  }
  useEffect(() => cancelPress, [])

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

  if (editing) {
    const ids = items.map((x) => x.id)
    const onDragEnd = ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) {
        onReorder?.(reorderIds(ids, Number(active.id), Number(over.id)))
      }
    }
    return (
      <div role="group" aria-label="Übungen bearbeiten" className="flex flex-wrap gap-[14px] px-5 pb-2 pt-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            {items.map((item, i) => (
              <EditTile key={item.id} item={item} index={i} onRemove={(id) => onRemove?.(id)} />
            ))}
          </SortableContext>
        </DndContext>
        {onAdd && <AddTile onAdd={onAdd} />}
      </div>
    )
  }

  return (
    <div
      ref={scroller}
      className="no-scrollbar relative flex snap-x snap-proximity scroll-px-5 gap-[5px] overflow-x-auto px-5 py-1 md:flex-wrap md:overflow-x-visible"
    >
      <div role="tablist" aria-label="Übungen" className="flex gap-[5px] md:flex-wrap" onKeyDown={onKeyDown}>
        {items.map((item, i) => {
          const isSelected = i === selected
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
              onPointerDown={startPress}
              onPointerMove={movePress}
              onPointerUp={cancelPress}
              onPointerCancel={cancelPress}
              onPointerLeave={cancelPress}
              // iOS blendet sonst beim Halten Lupe/Kontextmenü ein
              onContextMenu={onEditStart ? (e) => e.preventDefault() : undefined}
              className={cn(
                TILE_CLASS,
                'snap-start focus-visible:outline-none',
                onEditStart && 'select-none [-webkit-touch-callout:none]',
                STATUS_CLASS[item.progress.status],
                isSelected &&
                  'shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_hsl(var(--foreground))]',
              )}
            >
              <TileBody item={item} index={i} />
            </button>
          )
        })}
      </div>
      {onAdd && <AddTile onAdd={onAdd} />}
    </div>
  )
}
