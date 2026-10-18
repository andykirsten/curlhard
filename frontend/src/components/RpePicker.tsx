const VALUES = [6, 7, 8, 9, 10]

/**
 * Optionale Anstrengung (RPE) eines Satzes: 10 = Muskelversagen, 8 = noch 2 Wdh. im Tank.
 * Erneutes Tippen auf den gewählten Wert hebt die Auswahl auf. Fließt als Reserve in die
 * e1RM-Schätzung ein.
 */
export function RpePicker({
  value,
  onChange,
  compact,
}: {
  value: number | null
  onChange: (v: number | null) => void
  compact?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="RPE (Anstrengung)">
      <span className="w-9 shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        RPE
      </span>
      {VALUES.map((v) => {
        const selected = value === v
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`RPE ${v}${v === 10 ? ', bis zum Versagen' : `, ${10 - v} in Reserve`}`}
            className={`${compact ? 'h-8' : 'h-10'} flex-1 rounded-xl border-2 text-sm font-bold tabular-nums ${
              selected ? 'border-foreground bg-foreground text-background' : 'border-border'
            }`}
            onClick={() => onChange(selected ? null : v)}
          >
            {v}
          </button>
        )
      })}
    </div>
  )
}
