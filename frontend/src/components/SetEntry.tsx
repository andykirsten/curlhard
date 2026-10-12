import { Check } from 'lucide-react'
import { useState } from 'react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { formatWeight } from '@/lib/weight'

export interface SetValues {
  reps: number
  weight_kg: number
  is_warmup: boolean
}

interface SetEntryProps {
  initialReps: number
  initialWeight: number
  weightStep: number
  loadType?: string
  disabled?: boolean
  initialWarmup?: boolean
  submitLabel?: string
  onSubmit: (values: SetValues) => void
}

/** Eingabe zum Bearbeiten eines Satzes (Sheet); das Eingabe-Dock im Workout ist `InputDock`. */
export function SetEntry({
  initialReps,
  initialWeight,
  weightStep,
  loadType = 'weight',
  disabled,
  initialWarmup = false,
  submitLabel = 'Satz abhaken',
  onSubmit,
}: SetEntryProps) {
  const [reps, setReps] = useState(initialReps)
  const [weight, setWeight] = useState(initialWeight)
  const [warmup, setWarmup] = useState(initialWarmup)
  const isTime = loadType === 'time'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Stepper
          label={isTime ? 'Sekunden' : 'Wiederholungen'}
          value={reps}
          onChange={setReps}
          step={isTime ? 5 : 1}
        />
        {!isTime && (
          <Stepper
            label="Gewicht (kg)"
            value={weight}
            onChange={setWeight}
            step={weightStep}
            format={formatWeight}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={warmup}
            onChange={(e) => setWarmup(e.target.checked)}
          />
          Aufwärmsatz
        </label>
        <Button
          type="button"
          size="lg"
          disabled={disabled}
          onClick={() =>
            onSubmit({
              reps,
              weight_kg: isTime ? 0 : weight,
              is_warmup: warmup,
            })
          }
        >
          <Check className="h-5 w-5" /> {submitLabel}
        </Button>
      </div>
    </div>
  )
}
