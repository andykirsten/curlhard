import { subWeeks } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, Trophy, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  useExerciseHistory,
  type ExerciseRead,
  type InsightsRead,
  type SummaryRead,
} from '@/api'
import { Badge } from '@/components/ui/card'
import { daysAgoLabel, formatSeconds, kg, signedPct } from '@/lib/exerciseStats'
import { usePrefersReducedMotion } from '@/lib/useMediaQuery'
import { formatWeight } from '@/lib/weight'
import { Sparkline } from './Sparkline'

/** Zählt beim ersten Anzeigen von 0 hoch; ohne Animation bei „weniger Bewegung“. */
function useCountUp(target: number | null, reduced: boolean, durationMs = 900): number | null {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (target == null || reduced) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      setProgress(1 - (1 - t) ** 3)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, durationMs])
  if (target == null) return null
  return reduced ? target : target * progress
}

const LOAD_LABEL: Record<string, string> = {
  weight: 'Gewicht',
  bodyweight: 'Körpergewicht',
  assisted: 'Assistiert',
  time: 'Zeit',
}

export function ExerciseHero({
  exercise,
  muscleName,
  summary,
  insights,
}: {
  exercise: ExerciseRead
  muscleName?: string
  summary?: SummaryRead
  insights?: InsightsRead
}) {
  const reduced = usePrefersReducedMotion()
  const isTime = exercise.load_type === 'time'
  const [from] = useState(() => subWeeks(new Date(), 12).toISOString())
  const spark = useExerciseHistory(exercise.id, { from, metric: 'e1rm' })
  const sparkValues = (spark.data?.points ?? []).map((p) => (isTime ? p.duration_sec : p.e1rm))

  const bigTarget = isTime
    ? (insights?.lifetime.longest_hold_sec ?? null)
    : (summary?.e1rm ?? null)
  const shown = useCountUp(bigTarget, reduced)
  const change = summary?.change_4w_pct ?? null
  const plateau = insights?.plateau_weeks ?? null
  const lastPr = insights?.pr_events.at(-1)

  return (
    <section
      aria-label="Überblick"
      className="relative overflow-hidden rounded-2xl border p-5 md:p-7"
      style={{
        backgroundImage:
          'radial-gradient(120% 140% at 0% 0%, hsl(var(--primary) / 0.22), transparent 55%), radial-gradient(90% 120% at 100% 100%, hsl(var(--gold) / 0.2), transparent 60%)',
        backgroundColor: 'hsl(var(--card))',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-bold uppercase leading-none tracking-[0.18em] text-primary">
          {isTime ? 'Längste Haltezeit' : 'Geschätztes Maximum · e1RM'}
        </p>
        {muscleName && <Badge variant="secondary">{muscleName}</Badge>}
        <Badge variant="secondary">{LOAD_LABEL[exercise.load_type] ?? exercise.load_type}</Badge>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p
            className="font-display text-7xl leading-none tabular-nums md:text-8xl"
            aria-label={
              bigTarget == null ? 'Noch kein Wert' : isTime ? formatSeconds(bigTarget) : kg(bigTarget)
            }
          >
            {shown == null ? (
              <span className="text-muted-foreground">–</span>
            ) : isTime ? (
              <>{formatSeconds(Math.round(shown))}</>
            ) : (
              <>
                {formatWeight(shown)}
                <span className="ml-2 text-3xl text-muted-foreground md:text-4xl">kg</span>
              </>
            )}
          </p>
          {!isTime && change != null && (
            <p
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
                change >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/15 text-destructive'
              }`}
            >
              {change >= 0 ? (
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              ) : (
                <ArrowDownRight className="h-4 w-4" aria-hidden />
              )}
              {signedPct(change)} in 4 Wochen
            </p>
          )}
          {summary && summary.session_count === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Noch keine Sessions mit dieser Übung.
            </p>
          )}
        </div>
        {sparkValues.filter((v) => v != null).length > 1 && (
          <Sparkline
            values={sparkValues}
            width={160}
            height={64}
            className="h-16 w-32 shrink-0 md:h-20 md:w-48"
            label="Verlauf der letzten 12 Wochen"
          />
        )}
      </div>

      {plateau != null && plateau >= 4 && !isTime ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-secondary/80 px-3 py-2 text-sm font-semibold">
          <TrendingDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Plateau seit {plateau} Wochen – Variation probieren?
        </p>
      ) : (
        lastPr && (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 shrink-0 text-gold" aria-hidden />
            Letzter PR {daysAgoLabel(lastPr.date)}
          </p>
        )
      )}
      {!isTime && exercise.load_type !== 'weight' && (
        <p className="mt-3 text-xs text-muted-foreground">
          Berechnet mit deinem aktuellen Körpergewicht aus dem Profil.
        </p>
      )}
    </section>
  )
}
