import type { InsightsRead } from '@/api'
import { formatInt, formatSeconds, formatTonnage, kg } from '@/lib/exerciseStats'

function Tile({ label, value, hint, gold }: { label: string; value: string; hint?: string; gold?: boolean }) {
  return (
    <li className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-3xl leading-none tabular-nums md:text-4xl ${gold ? 'text-gold' : ''}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </li>
  )
}

/** Lebenszeit-Kennzahlen als große Kacheln; Zeitübungen zeigen Haltezeiten statt Tonnage. */
export function LifetimeTiles({ lifetime, loadType }: { lifetime: InsightsRead['lifetime']; loadType: string }) {
  const isTime = loadType === 'time'
  const heaviest = lifetime.heaviest_set
  const since = lifetime.days_since_last
  return (
    <section aria-label="Lebenszeit-Kennzahlen" className="space-y-3">
      <h2 className="text-lg">Insgesamt</h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isTime ? (
          <>
            <Tile
              label="Gesamtzeit"
              value={lifetime.total_time_sec != null ? formatSeconds(lifetime.total_time_sec) : '–'}
            />
            <Tile
              label="Längste Haltezeit"
              value={lifetime.longest_hold_sec != null ? formatSeconds(lifetime.longest_hold_sec) : '–'}
              gold
            />
          </>
        ) : (
          <>
            <Tile
              label="Bewegt"
              value={lifetime.total_volume != null ? formatTonnage(lifetime.total_volume) : '–'}
              hint="Gesamttonnage"
            />
            <Tile
              label="Schwerster Satz"
              value={heaviest ? kg(heaviest.weight_kg) : '–'}
              hint={heaviest ? `× ${heaviest.reps} Wdh.` : undefined}
              gold
            />
            <Tile label="Meiste Wdh." value={lifetime.most_reps != null ? String(lifetime.most_reps) : '–'} hint="in einem Satz" />
            <Tile
              label="Bestes Session-Volumen"
              value={lifetime.best_session_volume != null ? formatTonnage(lifetime.best_session_volume) : '–'}
            />
          </>
        )}
        <Tile label="Sessions" value={formatInt(lifetime.total_sessions)} hint={`${formatInt(lifetime.total_working_sets)} Arbeitssätze`} />
        <Tile
          label="Letzte Session"
          value={since == null ? '–' : since === 0 ? 'Heute' : `${since} ${since === 1 ? 'Tag' : 'Tage'}`}
          hint={since != null && since > 0 ? 'her' : undefined}
        />
        <Tile
          label="Ø Frequenz"
          value={lifetime.avg_sessions_per_week != null ? String(lifetime.avg_sessions_per_week).replace('.', ',') : '–'}
          hint="Sessions pro Woche"
        />
      </ul>
    </section>
  )
}
