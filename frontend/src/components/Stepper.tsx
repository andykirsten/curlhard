import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
}: StepperProps) {
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
        <output
          aria-label={label}
          className={cn(
            'text-center tabular-nums',
            dock
              ? 'order-first col-span-2 min-w-0 whitespace-nowrap font-display text-[40px] leading-none md:order-none md:col-span-1 md:flex-1'
              : 'min-w-[4.5rem] text-xl font-semibold',
          )}
        >
          {format ? format(value) : value}
        </output>
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
