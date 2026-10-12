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
  const buttonClass = dock ? 'h-[52px] w-12 rounded-[14px]' : undefined
  return (
    <div
      className={cn(
        dock ? 'flex flex-col gap-1.5 rounded-[18px] bg-background px-2.5 pb-2.5 pt-2' : 'flex items-center gap-2',
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
      <div className="flex items-center justify-between gap-1">
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
              ? 'min-w-0 flex-1 font-display text-[40px] leading-none'
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
