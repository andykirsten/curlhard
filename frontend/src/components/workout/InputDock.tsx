import { useState } from 'react'
import { RpePicker } from '@/components/RpePicker'
import { Stepper } from '@/components/Stepper'
import { Sheet } from '@/components/ui/sheet'
import { SET_KINDS, type SetKind } from '@/lib/setKind'
import { formatWeight } from '@/lib/weight'

/**
 * Ein Eingabe-Dock im Daumenbereich: Kilo/Wdh-Stepper für den nächsten Satz,
 * optionale RPE-Auswahl, Satzart-Auswahl und „Satz abhaken“. Zustand liegt beim Aufrufer, damit die
 * aktive Tabellenzeile die Werte live spiegeln kann.
 */
export function InputDock({
  weight,
  reps,
  kind,
  rpe,
  weightStep,
  loadType = 'weight',
  disabled,
  onWeight,
  onReps,
  onKind,
  onRpe,
  onSubmit,
  plates,
}: {
  weight: number
  reps: number
  kind: SetKind
  rpe: number | null
  weightStep: number
  loadType?: string
  disabled?: boolean
  onWeight: (v: number) => void
  onReps: (v: number) => void
  onKind: (v: SetKind) => void
  onRpe: (v: number | null) => void
  onSubmit: () => void
  /** Scheibenrechner-Zeile über den Steppern (nur mit Stangengewicht) */
  plates?: { summary: string; onOpen: () => void }
}) {
  const isTime = loadType === 'time'
  const warmup = kind === 'warmup'
  const [pickerOpen, setPickerOpen] = useState(false)
  const current = SET_KINDS.find((k) => k.value === kind)!
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-xl md:max-w-2xl rounded-t-[28px] border-t bg-card px-4 pb-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col gap-2.5">
        {plates && !isTime && (
          <button
            type="button"
            aria-label={`Scheibenrechner: ${plates.summary}`}
            className="-mb-1 truncate text-left text-xs font-semibold tabular-nums text-muted-foreground"
            onClick={plates.onOpen}
          >
            {plates.summary} ›
          </button>
        )}
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
              decimal
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
        {!isTime && !warmup && <RpePicker value={rpe} onChange={onRpe} compact />}
        <div className="flex gap-2.5">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Satzart: ${current.label}. Ändern`}
            className={`flex h-16 w-[92px] shrink-0 flex-col items-center justify-center rounded-2xl border-2 ${
              kind === 'normal' ? 'border-border' : 'border-foreground bg-foreground text-background'
            }`}
            onClick={() => setPickerOpen(true)}
          >
            <span className="font-display text-2xl leading-none">{current.short}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{current.name}</span>
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
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen} title="Satzart">
        <ul className="space-y-2 pb-2">
          {SET_KINDS.map((k) => (
            <li key={k.value}>
              <button
                type="button"
                aria-pressed={k.value === kind}
                className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border-2 px-3 text-left ${
                  k.value === kind ? 'border-primary' : 'border-border'
                }`}
                onClick={() => {
                  onKind(k.value)
                  setPickerOpen(false)
                }}
              >
                <span className="font-display text-2xl">{k.short}</span>
                <span>
                  <span className="block font-semibold">{k.label}</span>
                  <span className="block text-sm text-muted-foreground">{k.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}
