import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCreateSession, useListOnlineUsers, useToday, type TodayExercise } from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { cycleWeek } from '@/lib/cycle'
import { apiWeekday, weekdayLabel } from '@/lib/dates'
import { errorMessage } from '@/lib/query'
import { formatWeight } from '@/lib/weight'
import { useActiveSession } from '@/stores/activeSession'

/** Karte „Gerade online“: aktualisiert sich minütlich, ausgeblendet ohne Treffer. */
function OnlineCard() {
  const online = useListOnlineUsers({ query: { refetchInterval: 60_000 } })
  const users = online.data ?? []
  if (users.length === 0) return null
  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Gerade online
        </p>
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {users.map((u) => (
            <li key={u.id} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
              <Avatar name={u.display_name} src={u.avatar_url} size="md" />
              <span className="w-full truncate text-xs">{u.display_name}</span>
              {u.is_training && <Badge className="px-1.5 py-0 text-[10px]">trainiert</Badge>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function lastLabel(ex: TodayExercise): string | null {
  const work = ex.last_sets.filter((s) => !s.is_warmup)
  if (work.length === 0) return null
  const top = work[work.length - 1]!
  return `Zuletzt ${work.length}× ${top.reps} @ ${formatWeight(top.weight_kg)} kg`
}

export function TodayPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const weekday = apiWeekday()
  const { data, isLoading, error } = useToday({ weekday })
  const create = useCreateSession()
  const startSession = useActiveSession((s) => s.startSession)
  const activeId = useActiveSession((s) => s.sessionId)

  const start = (planDayId?: number) =>
    create.mutate(
      { data: { plan_day_id: planDayId ?? null } },
      {
        onSuccess: async (session) => {
          startSession(session.id)
          await queryClient.invalidateQueries()
          void navigate({
            to: '/workout/$sessionId',
            params: { sessionId: String(session.id) },
          })
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  if (isLoading) return <Spinner />
  if (error) return <p className="p-6 text-destructive">{errorMessage(error)}</p>

  return (
    <>
      <PageHeader title={`Heute · ${weekdayLabel(weekday)}`} profile />
      <div className="space-y-4 p-4">
        {data?.cycle && (
          <span className="inline-flex w-fit items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
            {`${data.cycle.name} · Woche ${cycleWeek(data.cycle.start_date)}`}
          </span>
        )}

        {activeId != null && (
          <Card className="border-primary">
            <CardContent className="flex items-center justify-between">
              <span className="font-medium">Ein Training läuft noch</span>
              <Button asChild size="sm">
                <Link to="/workout/$sessionId" params={{ sessionId: String(activeId) }}>
                  Fortsetzen
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!data?.plan && (
          <EmptyState
            title="Noch kein aktiver Plan"
            hint="Lege einen Trainingsplan an, um hier deinen Tag zu sehen – oder starte eine freie Session."
            action={
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/plans">Plan anlegen</Link>
                </Button>
                <Button variant="outline" onClick={() => start()}>
                  Freie Session
                </Button>
              </div>
            }
          />
        )}

        {data?.plan && !data.day && (
          <EmptyState
            title="Heute ist Ruhetag"
            hint={`In „${data.plan.name}“ ist für ${weekdayLabel(weekday)} nichts geplant.`}
          />
        )}

        {data?.day && (
          <section aria-label={data.day.name} className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {data.plan?.name}
              </p>
              <h2 className="font-display text-5xl uppercase leading-none">{data.day.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.day.exercises.length} Übungen ·{' '}
                {data.day.exercises.reduce((n, e) => n + e.target_sets, 0)} Sätze
              </p>
            </div>
            <ol className="divide-y rounded-lg border bg-card">
              {data.day.exercises.map((ex, i) => (
                <li key={ex.plan_exercise_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-8 font-display text-2xl text-primary tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{ex.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {ex.target_sets} × {ex.target_reps_min}–{ex.target_reps_max} Wdh ·{' '}
                      {ex.target_rest_sec} s Pause
                    </div>
                    {lastLabel(ex) && <div className="text-sm">{lastLabel(ex)}</div>}
                    {ex.permanent_note && (
                      <div className="text-sm italic text-muted-foreground">
                        {ex.permanent_note}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <Button
              size="lg"
              className="h-14 w-full font-display text-xl uppercase tracking-wide"
              disabled={create.isPending}
              onClick={() => start(data.day!.id)}
            >
              Workout starten
            </Button>
          </section>
        )}

        {data?.plan && (
          <section className="space-y-2">
            {data.other_days.length > 0 && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Anderen Tag wählen
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.other_days.map((d) => (
                    <Button key={d.id} variant="outline" size="sm" onClick={() => start(d.id)}>
                      {d.name}
                    </Button>
                  ))}
                </div>
              </>
            )}
            <Button variant="ghost" onClick={() => start()}>
              Freie Session starten
            </Button>
          </section>
        )}

        <OnlineCard />
      </div>
    </>
  )
}
