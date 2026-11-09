import { Trophy } from 'lucide-react'
import type { PrEvent } from '@/api'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/dates'
import { formatSeconds, kg, prLabel } from '@/lib/exerciseStats'

type TimelineEvent = PrEvent & { exercise_name?: string; load_type?: string }

/**
 * Vertikale Zeitleiste der Rekorde, neueste zuerst (max. 12 Einträge). Mit newestFirst sind die
 * Einträge schon so sortiert (übungsübergreifender Feed, dann mit Übungsname).
 */
export function PrTimeline({
  events,
  loadType = 'weight',
  newestFirst = false,
}: {
  events: TimelineEvent[]
  loadType?: string
  newestFirst?: boolean
}) {
  if (events.length === 0 || loadType === 'time') return null
  const recent = (newestFirst ? events : [...events].reverse()).slice(0, 12)
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-lg">Rekorde</h2>
        </div>
        <ol className="relative space-y-4 border-l-2 border-gold/40 pl-5">
          {recent.map((e, i) => (
            <li key={`${e.session_id}-${e.kind}-${e.reps}-${i}`} className="relative">
              <span
                aria-hidden
                className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-gold shadow-[0_0_8px_hsl(var(--gold)/0.7)]"
              />
              <p className="text-sm font-bold">
                {e.exercise_name ? `${e.exercise_name} · ` : ''}
                {prLabel(e.kind, e.reps)}
              </p>
              <p className="text-sm tabular-nums">
                {e.kind === 'reps'
                  ? `${e.value} Wdh.`
                  : (e.load_type ?? loadType) === 'time'
                    ? formatSeconds(e.value)
                    : kg(e.value)}
                <span className="text-muted-foreground">
                  {' '}
                  · {formatDate(e.date, 'd. MMM yyyy')}
                </span>
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
