import { Stepper } from '@/components/Stepper'
import { formatWeight } from '@/lib/weight'

/**
 * Ein Eingabe-Dock im Daumenbereich: Kilo/Wdh-Stepper für den nächsten Satz,
 * Aufwärm-Toggle und „Satz abhaken“. Zustand liegt beim Aufrufer, damit die
 * aktive Tabellenzeile die Werte live spiegeln kann.
 */
export function InputDock({
  weight,
  reps,
  warmup,
  weightStep,
  loadType = 'weight',
  disabled,
  onWeight,
  onReps,
  onWarmup,
  onSubmit,
}: {
  weight: number
  reps: number
  warmup: boolean
  weightStep: number
  loadType?: string
  disabled?: boolean
  onWeight: (v: number) => void
  onReps: (v: number) => void
  onWarmup: (v: boolean) => void
  onSubmit: () => void
}) {
  const isTime = loadType === 'time'
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-xl md:max-w-2xl rounded-t-[28px] border-t bg-card px-4 pb-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col gap-2.5">
        <div className={`grid gap-2.5 ${isTime ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!isTime && (
            <Stepper
              variant="dock"
              shortLabel="Kilo"
              label="Gewicht (kg)"
              value={weight}
              onChange={onWeight}
              step={weightStep}
              format={formatWeight}
            />
          )}
          <Stepper
            variant="dock"
            shortLabel={isTime ? 'Sek' : 'Wdh'}
            label={isTime ? 'Sekunden' : 'Wiederholungen'}
            value={reps}
            onChange={onReps}
            step={isTime ? 5 : 1}
          />
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={warmup}
            aria-label="Aufwärmsatz"
            className={`flex h-16 w-[92px] shrink-0 flex-col items-center justify-center rounded-2xl border-2 ${
              warmup ? 'border-foreground bg-foreground text-background' : 'border-border'
            }`}
            onClick={() => onWarmup(!warmup)}
          >
            <span className="font-display text-2xl leading-none">W</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Aufwärm.</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary font-display text-[26px] uppercase tracking-wide text-primary-foreground disabled:opacity-50"
            onClick={onSubmit}
          >
            ✓ Satz abhaken
          </button>
        </div>
      </div>
    </div>
  )
}
