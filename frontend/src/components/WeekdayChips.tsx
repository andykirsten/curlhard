import { WEEKDAYS, WEEKDAYS_SHORT, weekdaysLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'

/** Häufige Muster für Ganzkörperpläne: ein Tipp setzt die ganze Woche. */
const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Mo · Mi · Fr', days: [0, 2, 4] },
  { label: 'Di · Do · Sa', days: [1, 3, 5] },
]

/**
 * Mehrfachauswahl der Wochentage eines Trainingstags. `taken` nennt Wochentage, die schon
 * einem anderen Trainingstag des Plans zugeordnet sind (Wochentag → Name).
 */
export function WeekdayChips({
  value,
  taken = {},
  onChange,
}: {
  value: readonly number[]
  taken?: Partial<Record<number, string>>
  onChange: (weekdays: number[]) => void
}) {
  const toggle = (i: number) =>
    onChange(value.includes(i) ? value.filter((w) => w !== i) : [...value, i].sort((a, b) => a - b))
  const clashes = value.filter((w) => taken[w] != null)

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Wochentage" className="grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((short, i) => {
          const active = value.includes(i)
          const other = taken[i]
          return (
            <button
              key={short}
              type="button"
              aria-pressed={active}
              aria-label={other ? `${WEEKDAYS[i]} (auch „${other}“)` : WEEKDAYS[i]}
              onClick={() => toggle(i)}
              className={cn(
                'h-11 rounded-full border font-display text-sm uppercase transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground',
                other && 'border-dashed',
              )}
            >
              {short}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {value.length > 1
            ? `${value.length}× pro Woche · ${weekdaysLabel(value, true)}`
            : weekdaysLabel(value)}
        </span>
        {value.length <= 1 &&
          PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="rounded-full border px-2 py-0.5 font-medium text-foreground hover:bg-accent"
              onClick={() => onChange(p.days)}
            >
              {p.label}
            </button>
          ))}
      </div>
      {clashes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {clashes.map((w) => `${WEEKDAYS_SHORT[w]}: auch „${taken[w]}“`).join(' · ')} – dort
          gilt der weiter oben stehende Tag.
        </p>
      )}
    </div>
  )
}
