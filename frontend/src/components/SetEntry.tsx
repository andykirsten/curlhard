import { Check } from 'lucide-react'
import { useState } from 'react'
import { RpePicker } from '@/components/RpePicker'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { kindFields, SET_KINDS, type SetKind, type SetType } from '@/lib/setKind'
import { formatWeight } from '@/lib/weight'

export interface SetValues {
  reps: number
  weight_kg: number
  is_warmup: boolean
  set_type: SetType
  /** Anstrengung 6–10, null = nicht angegeben (bei Aufwärm- und Zeitsätzen immer null) */
  rpe: number | null
}

interface SetEntryProps {
  initialReps: number
  initialWeight: number
  weightStep: number
  loadType?: string
  disabled?: boolean
  initialKind?: SetKind
  initialRpe?: number | null
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
  initialKind = 'normal',
  initialRpe = null,
  submitLabel = 'Satz abhaken',
  onSubmit,
}: SetEntryProps) {
  const [reps, setReps] = useState(initialReps)
  const [weight, setWeight] = useState(initialWeight)
  const [kind, setKind] = useState<SetKind>(initialKind)
  const warmup = kind === 'warmup'
  const [rpe, setRpe] = useState<number | null>(initialRpe)
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
            decimal
          />
        )}
      </div>
      {!isTime && !warmup && <RpePicker value={rpe} onChange={setRpe} />}
      <Segmented
        aria-label="Satzart"
        value={kind}
        onChange={(v) => setKind(v as SetKind)}
        options={SET_KINDS.map((k) => ({ value: k.value, label: k.name }))}
      />
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          size="lg"
          disabled={disabled}
          onClick={() =>
            onSubmit({
              reps,
              weight_kg: isTime ? 0 : weight,
              ...kindFields(kind),
              rpe: isTime || warmup ? null : rpe,
            })
          }
        >
          <Check className="h-5 w-5" /> {submitLabel}
        </Button>
      </div>
    </div>
  )
}
