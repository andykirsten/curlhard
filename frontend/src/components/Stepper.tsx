import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { parseWeight } from '@/lib/weight'
import { cn } from '@/lib/utils'

interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step: number
  min?: number
  format?: (v: number) => string
  /** „dock“: große Kachel fürs Eingabe-Dock mit sichtbarem Kurzlabel */
  variant?: 'default' | 'dock'
  /** Sichtbares Kurzlabel (nur Variante dock), z. B. „Kilo“ */
  shortLabel?: string
  /** Erlaubt Kommazahlen bei der Tastatureingabe (z. B. Gewicht) */
  decimal?: boolean
}

function parseInput(input: string, decimal: boolean): number | null {
  if (decimal) return parseWeight(input)
  const trimmed = input.trim()
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null
}

export function Stepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  format,
  variant = 'default',
  shortLabel,
  decimal = false,
}: StepperProps) {
  // Während der Tastatureingabe zeigt das Feld den Rohtext (darf leer sein),
  // sonst den formatierten Wert.
  const [draft, setDraft] = useState<string | null>(null)
  const apply = (dir: 1 | -1) => {
    const next = Math.round((value + dir * step) * 1000) / 1000
    onChange(Math.max(min, next))
  }
  const dock = variant === 'dock'
  const buttonClass = dock ? 'h-11 w-full rounded-[14px] md:h-[52px] md:w-12' : undefined
  return (
    <div
      className={cn(
        dock
          ? 'flex flex-col gap-1.5 rounded-[18px] bg-background px-2.5 pb-2.5 pt-2'
          : 'flex items-center gap-2',
      )}
      role="group"
      aria-label={label}
    >
      {dock && (
        <span
          aria-hidden
          className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
        >
          {shortLabel ?? label}
        </span>
      )}
      <div
        className={cn(
          dock
            ? 'grid grid-cols-2 gap-1.5 md:flex md:items-center md:justify-between md:gap-1'
            : 'flex items-center justify-between gap-1',
        )}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={buttonClass}
          aria-label={`${label} verringern`}
          onClick={() => apply(-1)}
        >
          <Minus className="h-5 w-5" />
        </Button>
        <input
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          autoComplete="off"
          aria-label={label}
          className={cn(
            'rounded-md bg-transparent text-center tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring',
            dock
              ? 'order-first col-span-2 w-full min-w-0 font-display text-[40px] leading-none md:order-none md:col-span-1 md:flex-1'
              : 'w-[4.5rem] text-xl font-semibold',
          )}
          value={draft ?? (format ? format(value) : String(value))}
          onFocus={(e) => {
            setDraft(format ? format(value) : String(value))
            e.target.select()
          }}
          onChange={(e) => {
            setDraft(e.target.value)
            const parsed = parseInput(e.target.value, decimal)
            if (parsed !== null) onChange(Math.max(min, parsed))
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={buttonClass}
          aria-label={`${label} erhöhen`}
          onClick={() => apply(1)}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
