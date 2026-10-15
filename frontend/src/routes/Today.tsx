import { keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  useCreateSession,
  useListOnlineUsers,
  useListSessions,
  useToday,
  type TodayExercise,
} from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { WeekStrip } from '@/components/WeekStrip'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { cycleWeek } from '@/lib/cycle'
import { apiWeekday } from '@/lib/dates'
import { errorMessage } from '@/lib/query'
import { useLocalDayStart } from '@/lib/useLocalDayStart'
import { buildWeek, dayKicker, planByWeekday, splitDayName, weekRangeLabel } from '@/lib/week'
import { formatWeight } from '@/lib/weight'
import { cn } from '@/lib/utils'
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
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
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

/** Titel des gewählten Tages: „Ganzkörper B“ mit Buchstaben in Akzentfarbe, sonst „Ruhetag“. */
function DayTitle({ name }: { name: string | null }) {
  const { title, letter } = name ? splitDayName(name) : { title: 'Ruhetag', letter: '' }
  return (
    <h2 className="mt-3 break-words font-display text-[60px] uppercase leading-[0.86]">
      {title}
      {letter && <span className="text-primary"> {letter}</span>}
    </h2>
  )
}

/** Großer Button der Tageskarte (Design: 60 px hoch, Anton 24 px); `outline` = transparent mit Rahmen. */
function HeroButton({
  outline,
  className,
  ...props
}: ComponentProps<typeof Button> & { outline?: boolean; children: ReactNode }) {
  return (
    <Button
      variant={outline ? 'outline' : 'default'}
      className={cn(
        'h-[60px] w-full rounded-2xl font-display text-2xl font-normal uppercase',
        outline && 'bg-transparent',
        className,
      )}
      {...props}
    />
  )
}

export function TodayPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Wochenleiste: Index 0 = heute; Mitternacht und Rückkehr in die App springen auf heute
  const [selected, setSelected] = useState(0)
  const dayStart = useLocalDayStart(() => setSelected(0))
  const weekday = (apiWeekday(dayStart) + selected) % 7
  const { data, isLoading, error } = useToday(
    { weekday },
    { query: { placeholderData: keepPreviousData } },
  )
  // Erledigt = beendete Session mit Start heute (über Mitternacht zählt der Starttag)
  const sessionsToday = useListSessions({ from: dayStart.toISOString() })
  const doneSession = sessionsToday.data?.find((s) => s.finished_at != null) ?? null
  const listRef = useRef<HTMLElement>(null)
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

  const byWeekday = useMemo(
    () => planByWeekday([...(data?.day ? [data.day] : []), ...(data?.other_days ?? [])]),
    [data],
  )
  const week = useMemo(
    () => buildWeek(dayStart, byWeekday, doneSession != null),
    [dayStart, byWeekday, doneSession],
  )
  const selDay = week[selected]!
  // Während der Wochentag nachlädt, gehört `data.day` evtl. noch zum vorher gewählten Tag
  const day = data?.day && data.day.id === selDay.plan?.id ? data.day : null
  const done = selDay.status === 'done'

  if (isLoading) return <Spinner />
  if (error) return <p className="p-6 text-destructive">{errorMessage(error)}</p>

  return (
    <>
      <PageHeader title="Heute" profile />
      <div className="space-y-4 p-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        {data?.cycle && (
          <span className="inline-flex w-fit items-center lg:col-span-2 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
            {`${data.cycle.name} · Woche ${cycleWeek(data.cycle.start_date)}`}
          </span>
        )}

        {activeId != null && (
          <Card className="border-primary lg:col-span-2">
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

        {data?.plan && (
          <section aria-label="Tagesauswahl" className="lg:col-span-2">
            <p className="text-[13px] font-bold uppercase leading-none tracking-[0.18em] text-primary">
              {dayKicker(selDay)}
            </p>
            <DayTitle name={selDay.plan?.name ?? null} />
            <p className="mt-3 min-h-[15px] text-[15px] font-semibold leading-none text-muted-foreground">
              {!selDay.plan
                ? 'Kein Training geplant'
                : done
                  ? 'Erledigt'
                  : day
                    ? `${day.exercises.length} Übungen · ${day.exercises.reduce((n, e) => n + e.target_sets, 0)} Sätze`
                    : null}
            </p>
            <div className="mt-[18px]">
              <WeekStrip week={week} selected={selected} onSelect={setSelected} />
            </div>
            <div className="mt-2.5 flex justify-between text-xs font-semibold leading-none text-muted-foreground">
              <span>{weekRangeLabel(week)}</span>
              {selected !== 0 && (
                <button
                  type="button"
                  className="font-bold text-primary"
                  onClick={() => setSelected(0)}
                >
                  ← Zurück zu heute
                </button>
              )}
            </div>
            <div className="mt-5">
              {selDay.plan && selected === 0 && !done && (
                <HeroButton disabled={create.isPending} onClick={() => start(selDay.plan!.id)}>
                  Workout starten
                </HeroButton>
              )}
              {done && doneSession && (
                <HeroButton outline asChild>
                  <Link to="/workout/$sessionId" params={{ sessionId: String(doneSession.id) }}>
                    Zusammenfassung
                  </Link>
                </HeroButton>
              )}
              {selDay.plan && selected !== 0 && (
                <HeroButton
                  outline
                  onClick={() =>
                    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  Vorschau ansehen
                </HeroButton>
              )}
              {!selDay.plan && selected === 0 && (
                <HeroButton outline disabled={create.isPending} onClick={() => start()}>
                  Trotzdem trainieren
                </HeroButton>
              )}
              {!selDay.plan && selected !== 0 && (
                <HeroButton outline asChild>
                  <Link to="/plans/$planId" params={{ planId: String(data.plan.id) }}>
                    Training einplanen
                  </Link>
                </HeroButton>
              )}
            </div>
          </section>
        )}

        {day && (
          <section ref={listRef} aria-label={day.name} className="scroll-mt-20">
            <ol className="divide-y rounded-lg border bg-card">
              {day.exercises.map((ex, i) => (
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
