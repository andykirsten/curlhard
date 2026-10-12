import { cn } from '@/lib/utils'

/** Segmentierte Auswahl (Radio-Gruppe), z. B. für Tabs oder Einstellungen. */
export function Segmented({
  value,
  options,
  onChange,
  'aria-labelledby': labelledBy,
  'aria-label': label,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  'aria-labelledby'?: string
  'aria-label'?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={label}
      className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-secondary p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-10 rounded-md text-sm font-semibold transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
