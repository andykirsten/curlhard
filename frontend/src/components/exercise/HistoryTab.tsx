import { Link } from '@tanstack/react-router'
import { ChevronRight, Trophy } from 'lucide-react'
import type { LogSession } from '@/api'
import { Spinner } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { formatSeconds, groupByMonth, kg, prLabel, signedPct } from '@/lib/exerciseStats'
import { formatWeight } from '@/lib/weight'
import { useExerciseLogPages } from './useExerciseLogPages'

function setLabel(reps: number, weight: number, loadType: string): string {
  if (loadType === 'time') return formatSeconds(reps)
  if (loadType === 'bodyweight') return weight > 0 ? `${reps} × +${formatWeight(weight)} kg` : `${reps} Wdh.`
  if (loadType === 'assisted') return weight > 0 ? `${reps} × −${formatWeight(weight)} kg` : `${reps} Wdh.`
  return `${formatWeight(weight)} kg × ${reps}`
}

export function SessionCard({ item, loadType }: { item: LogSession; loadType: string }) {
  const m = item.metrics
  const delta = item.e1rm_delta_pct
  const hasPr = item.sets.some((s) => s.records.length > 0)
  return (
    <li>
      <Link
        to="/workout/$sessionId"
        params={{ sessionId: String(item.session_id) }}
        className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40 active:bg-accent/60"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[13px] font-bold uppercase leading-none tracking-[0.18em] text-primary">
              {formatDate(item.started_at, 'EEE, d. MMM yyyy')}
              {hasPr && <Trophy className="h-3.5 w-3.5 text-gold" aria-label="Rekord in dieser Session" />}
            </p>
            {(item.plan_day_name || item.cycle_name) && (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {[item.plan_day_name, item.cycle_name].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {item.sets.map((s) => (
            <li
              key={s.set_number}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums ${
                s.is_warmup ? 'bg-secondary/60 text-muted-foreground' : 'bg-secondary'
              } ${s.records.length > 0 ? 'ring-1 ring-gold' : ''}`}
            >
              {s.is_warmup && <span className="text-[11px] font-bold uppercase">W</span>}
              {setLabel(s.reps, s.weight_kg, loadType)}
              {s.rpe != null && (
                <span className="text-xs font-medium text-muted-foreground">
                  @{String(s.rpe).replace('.', ',')}
                </span>
              )}
              {s.records.length > 0 && (
                <span
                  className="rounded-full bg-gold px-1.5 text-[10px] font-extrabold uppercase text-background"
                  title={s.records.map((r) => prLabel(r.kind, r.reps ?? null)).join(', ')}
                >
                  PR
                </span>
              )}
            </li>
          ))}
        </ul>

        {m && (
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {m.volume != null && (
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Volumen</dt>
                <dd className="font-bold tabular-nums">{kg(m.volume)}</dd>
              </div>
            )}
            {m.e1rm != null && (
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">e1RM</dt>
                <dd className="font-bold tabular-nums">
                  {kg(m.e1rm)}
                  {delta != null && delta !== 0 && (
                    <span
                      className={`ml-1.5 text-xs ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                    >
                      {signedPct(delta)}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {m.duration_sec != null && (
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Gesamtzeit</dt>
                <dd className="font-bold tabular-nums">{formatSeconds(m.duration_sec)}</dd>
              </div>
            )}
          </dl>
        )}
        {item.note && <p className="mt-2 text-sm italic text-muted-foreground">{item.note}</p>}
      </Link>
    </li>
  )
}

export function HistoryTab({ exerciseId, loadType }: { exerciseId: number; loadType: string }) {
  const log = useExerciseLogPages(exerciseId)
  const items = log.data?.pages.flatMap((p) => p.items) ?? []
  if (log.isLoading) return <Spinner />
  if (log.isError) {
    return (
      <p role="alert" className="p-6 text-center text-sm text-destructive">
        Historie konnte nicht geladen werden.
      </p>
    )
  }
  if (items.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        Noch keine Sessions mit dieser Übung.
      </p>
    )
  }
  const groups = groupByMonth(items, (i) => i.started_at)
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label} className="space-y-3">
          <h2 className="text-lg capitalize">{g.label}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {g.items.map((item) => (
              <SessionCard key={item.session_id} item={item} loadType={loadType} />
            ))}
          </ul>
        </section>
      ))}
      {log.hasNextPage && (
        <Button
          variant="outline"
          className="w-full"
          disabled={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
        >
          {log.isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}
        </Button>
      )}
    </div>
  )
}
