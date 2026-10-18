import { Link } from '@tanstack/react-router'
import { subWeeks } from 'date-fns'
import { useState } from 'react'
import { useExerciseHistory, useExerciseInsights, useExerciseLog, useExerciseSummary } from '@/api'
import { NextTargets } from '@/components/exercise/NextTargetCard'
import { Sparkline } from '@/components/exercise/Sparkline'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { formatDate } from '@/lib/dates'
import { formatSeconds, kg, signedPct } from '@/lib/exerciseStats'
import { formatWeight } from '@/lib/weight'

function Content({ exerciseId, loadType }: { exerciseId: number; loadType: string }) {
  const isTime = loadType === 'time'
  const summary = useExerciseSummary(exerciseId)
  const insights = useExerciseInsights(exerciseId)
  const log = useExerciseLog(exerciseId, { limit: 3 })
  const [from] = useState(() => subWeeks(new Date(), 12).toISOString())
  const history = useExerciseHistory(exerciseId, { from, metric: 'e1rm' })
  const spark = (history.data?.points ?? []).map((p) => (isTime ? p.duration_sec : p.e1rm))
  const change = summary.data?.change_4w_pct ?? null
  const big = isTime ? insights.data?.lifetime.longest_hold_sec : summary.data?.e1rm
  const sessions = log.data?.items ?? []

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-end justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <p className="text-[13px] font-bold uppercase leading-none tracking-[0.18em] text-primary">
            {isTime ? 'Längste Haltezeit' : 'e1RM'}
          </p>
          <p className="mt-2 font-display text-5xl leading-none tabular-nums">
            {big == null ? '–' : isTime ? formatSeconds(big) : kg(big)}
          </p>
          {!isTime && change != null && (
            <p
              className={`mt-2 text-sm font-bold ${change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
            >
              {signedPct(change)} in 4 Wochen
            </p>
          )}
        </div>
        {spark.filter((v) => v != null).length > 1 && (
          <Sparkline
            values={spark}
            width={140}
            height={56}
            className="h-14 w-28 shrink-0"
            label="Verlauf der letzten 12 Wochen"
          />
        )}
      </div>

      {!isTime && insights.data && insights.data.rep_profile.length > 0 && (
        <section aria-label="Nächstes PR-Ziel" className="space-y-2">
          <h3 className="text-base">Nächstes PR-Ziel</h3>
          <NextTargets profile={insights.data.rep_profile} compact />
        </section>
      )}

      <section aria-label="Letzte Sessions" className="space-y-2">
        <h3 className="text-base">Letzte Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Sessions mit dieser Übung.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sessions.map((s) => {
              const working = s.sets.filter((x) => !x.is_warmup)
              return (
                <li key={s.session_id} className="px-3 py-2 text-sm">
                  <div className="font-semibold">{formatDate(s.started_at, 'EEE, d. MMM')}</div>
                  <div className="tabular-nums text-muted-foreground">
                    {working
                      .map((x) =>
                        isTime ? formatSeconds(x.reps) : `${formatWeight(x.weight_kg)}×${x.reps}`,
                      )
                      .join(' · ') || 'Nur Aufwärmsätze'}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild>
          <Link
            to="/exercises/$exerciseId"
            params={{ exerciseId: String(exerciseId) }}
            search={{ tab: 'statistik' }}
          >
            Alle Statistiken
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link
            to="/exercises/$exerciseId"
            params={{ exerciseId: String(exerciseId) }}
            search={{ tab: 'historie' }}
          >
            Historie
          </Link>
        </Button>
      </div>
    </div>
  )
}

/** Schnellansicht zur Übung im Workout: Kennzahlen, PR-Ziele und letzte Sessions als Bottom-Sheet. */
export function ExercisePeekSheet({
  open,
  onOpenChange,
  exerciseId,
  name,
  loadType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseId: number
  name: string
  loadType: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={name}>
      {open && <Content exerciseId={exerciseId} loadType={loadType} />}
    </Sheet>
  )
}
