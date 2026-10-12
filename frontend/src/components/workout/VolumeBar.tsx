import { volumePercent } from '@/lib/workout'

/** Volumen der Übung heute, Balken relativ zum letzten Mal (Füllung max. 100 %). */
export function VolumeBar({
  exercise,
  today,
  last,
  unit,
}: {
  exercise: string
  today: number
  last: number
  unit: 'kg' | 's'
}) {
  const percent = volumePercent(today, last)
  const fill = percent == null ? 0 : Math.min(100, percent)
  return (
    <section aria-label="Volumen" className="px-5 pb-4">
      <div className="flex items-baseline justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <span className="truncate">Volumen {exercise}</span>
        {percent != null && <span className="shrink-0 tabular-nums">{percent} % vom letzten Mal</span>}
      </div>
      <div className="mt-1 flex items-center gap-4">
        <p className="font-display text-[30px] leading-none tabular-nums">
          {Math.round(today).toLocaleString('de-DE')}{' '}
          <span className="text-base text-muted-foreground">{unit}</span>
        </p>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${fill}%` }} />
        </div>
      </div>
    </section>
  )
}
