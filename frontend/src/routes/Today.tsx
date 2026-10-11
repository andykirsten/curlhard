import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCreateSession, useToday, type TodayExercise } from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiWeekday, weekdayLabel } from '@/lib/dates'
import { errorMessage } from '@/lib/query'
import { formatWeight } from '@/lib/weight'
import { useActiveSession } from '@/stores/activeSession'

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
          <section aria-label={data.day.name} className="space-y-3">
            <h2 className="text-lg font-semibold">{data.day.name}</h2>
            <ul className="space-y-2">
              {data.day.exercises.map((ex) => (
                <li key={ex.plan_exercise_id}>
                  <Card>
                    <CardContent className="space-y-1 py-3">
                      <div className="font-medium">{ex.name}</div>
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
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full"
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
      </div>
    </>
  )
}
