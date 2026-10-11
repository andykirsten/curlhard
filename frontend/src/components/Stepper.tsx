import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step: number
  min?: number
  format?: (v: number) => string
}

export function Stepper({ label, value, onChange, step, min = 0, format }: StepperProps) {
  const apply = (dir: 1 | -1) => {
    const next = Math.round((value + dir * step) * 1000) / 1000
    onChange(Math.max(min, next))
  }
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={`${label} verringern`}
        onClick={() => apply(-1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <output
        aria-label={label}
        className="min-w-[4.5rem] text-center text-xl font-semibold tabular-nums"
      >
        {format ? format(value) : value}
      </output>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={`${label} erhöhen`}
        onClick={() => apply(1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
