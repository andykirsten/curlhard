import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  getGetSessionDetailQueryKey,
  useAddSessionExercise,
  useAddSet,
  useDeleteSession,
  useDeleteSessionExercise,
  useDeleteSet,
  useExerciseSummary,
  useFinishSession,
  useGetNote,
  useGetSessionDetail,
  useListExercises,
  usePutNote,
  useToday,
  useUpdateSession,
  useUpdateSessionExercise,
  useUpdateSet,
  type ExerciseRead,
  type LastSet,
  type SessionExerciseRead,
  type SessionRead,
  type SetRead,
} from '@/api'
import { ExercisePicker } from '@/components/ExercisePicker'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { SetEntry, type SetValues } from '@/components/SetEntry'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { apiWeekday, durationLabel, formatDateTime } from '@/lib/dates'
import { errorMessage } from '@/lib/query'
import { formatWeight } from '@/lib/weight'
import { useActiveSession } from '@/stores/activeSession'
import { useSettings } from '@/stores/settings'

interface RecordMomentData {
  exercise: string
  records: number[]
  weight: number
  reps: number
  e1: number
}

/** Vollbild-Moment bei neuem Rekord (Design „Rekord-Moment“). */
function RecordMoment({ data, onClose }: { data: RecordMomentData; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Neuer Rekord"
      className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col justify-between bg-primary p-6 text-primary-foreground"
    >
      <p className="text-sm font-semibold uppercase tracking-widest opacity-80">{data.exercise}</p>
      <div>
        <h2 className="font-display text-7xl uppercase leading-none">
          Neuer
          <br />
          Rekord
        </h2>
        <p className="mt-6 font-display text-5xl tabular-nums">
          {formatWeight(data.weight)} kg × {data.reps}
        </p>
        <p className="mt-2 text-lg tabular-nums opacity-80">
          e1RM {formatWeight(data.e1)} kg · {data.records.map((n) => `${n}RM`).join(' · ')}
        </p>
      </div>
      <Button variant="secondary" size="lg" className="h-14 w-full" onClick={onClose}>
        Weiter pumpen
      </Button>
    </div>
  )
}

/** Geschätztes Maximum nach Epley (wie in backend/app/services/stats.py) */
function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

function SetRow({
  set,
  prev,
  records,
  weightStep,
  loadType,
  onUpdate,
  onDelete,
}: {
  set: SetRead
  prev: LastSet | undefined
  records: number[]
  weightStep: number
  loadType: string
  onUpdate: (values: SetValues) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <li className="rounded-md border p-3">
        <SetEntry
          initialReps={set.reps}
          initialWeight={set.weight_kg}
          weightStep={weightStep}
          loadType={loadType}
          onSubmit={(v) => {
            onUpdate(v)
            setEditing(false)
          }}
        />
      </li>
    )
  }
  const delta =
    loadType === 'time' || !prev || set.is_warmup
      ? null
      : e1rm(set.weight_kg, set.reps) - e1rm(prev.weight_kg, prev.reps)
  return (
    <li className="grid grid-cols-[2rem_1fr_1fr_3.5rem_auto] items-center gap-2 py-2">
      <span className="text-center font-display text-lg text-muted-foreground">
        {set.is_warmup ? 'W' : set.set_number}
      </span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {prev
          ? loadType === 'time'
            ? `${prev.reps} s`
            : `${prev.reps} × ${formatWeight(prev.weight_kg)} kg`
          : '–'}
      </span>
      <span className="font-semibold tabular-nums">
        {loadType === 'time' ? `${set.reps} s` : `${set.reps} × ${formatWeight(set.weight_kg)} kg`}
      </span>
      <span
        className={`text-right text-sm font-semibold tabular-nums ${
          delta != null && delta >= 0 ? 'text-primary' : 'text-muted-foreground'
        }`}
        aria-label="Veränderung ggü. letztem Mal"
      >
        {delta == null
          ? '–'
          : `${delta >= 0 ? '+' : '−'}${formatWeight(Math.abs(Math.round(delta * 10) / 10))}`}
      </span>
      <div className="flex items-center justify-end gap-1">
        {records.length > 0 && (
          <Badge variant="record" aria-label="Neuer Rekord">
            Rekord {records.map((n) => `${n}RM`).join(' · ')}
          </Badge>
        )}
        <button
          type="button"
          aria-label="Satz bearbeiten"
          className="rounded-md p-2 hover:bg-accent"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Satz löschen"
          className="rounded-md p-2 hover:bg-accent"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}

function PermanentNote({ exerciseId }: { exerciseId: number }) {
  const { data } = useGetNote(exerciseId)
  const put = usePutNote()
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Textarea
      aria-label="Dauerhaftes Memo"
      placeholder="Dauerhaftes Memo (z. B. Sitzeinstellung)"
      rows={2}
      value={draft ?? data?.note ?? ''}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft != null && draft !== (data?.note ?? '')) {
          put.mutate(
            { exerciseId, data: { note: draft } },
            {
              onSuccess: () => setDraft(null),
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      }}
    />
  )
}

/** Session-Notiz: speichert beim Verlassen des Feldes, wenn sich der Text geändert hat. */
function SessionNote({ session }: { session: SessionRead }) {
  const queryClient = useQueryClient()
  const update = useUpdateSession()
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Textarea
      aria-label="Session-Notiz"
      placeholder="Notiz zur Session"
      rows={2}
      value={draft ?? session.note ?? ''}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft != null && draft !== (session.note ?? '')) {
          update.mutate(
            { sessionId: session.id, data: { note: draft } },
            {
              onSuccess: async () => {
                await queryClient.invalidateQueries({
                  queryKey: getGetSessionDetailQueryKey(session.id),
                })
                setDraft(null)
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      }}
    />
  )
}

function ExerciseCard({
  se,
  exercise,
  restSec,
  todayLast,
  prevSets,
  recordsBySet,
  onRecords,
  onRecordMoment,
  session,
}: {
  se: SessionExerciseRead
  exercise: ExerciseRead | undefined
  restSec: number
  todayLast: { reps: number; weight_kg: number } | null
  /** Arbeitssätze des letzten Trainings am selben Tag, Index = Satznummer - 1 */
  prevSets: LastSet[]
  recordsBySet: Record<number, number[]>
  onRecords: (setId: number, records: number[]) => void
  onRecordMoment: (moment: RecordMomentData) => void
  session: SessionRead
}) {
  const queryClient = useQueryClient()
  const weightStep = useSettings((s) => s.weightStep)
  const startRest = useActiveSession((s) => s.startRest)
  const key = getGetSessionDetailQueryKey(session.id)
  const addSet = useAddSet()
  const updateSet = useUpdateSet()
  const deleteSet = useDeleteSet()
  const updateSe = useUpdateSessionExercise()
  const deleteSe = useDeleteSessionExercise()
  const summary = useExerciseSummary(se.exercise_id, {
    query: { enabled: !todayLast },
  })
  const loadType = exercise?.load_type ?? 'weight'

  const lastSet = se.sets.filter((s) => !s.is_warmup).at(-1)
  const fallback = summary.data?.last_session?.best_set
  const prefill = lastSet
    ? { reps: lastSet.reps, weight: lastSet.weight_kg }
    : todayLast
      ? { reps: todayLast.reps, weight: todayLast.weight_kg }
      : { reps: fallback?.reps ?? 8, weight: fallback?.weight_kg ?? 20 }

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const showError = (e: unknown) => toast.error(errorMessage(e))

  const log = async (v: SetValues) => {
    const tempId = -Date.now()
    // Laufende Refetches abbrechen, damit ein veralteter Stand den Optimistic Update nicht überschreibt
    await queryClient.cancelQueries({ queryKey: key })
    // Optimistic Update: Satz erscheint sofort, Timer startet ohne auf den Server zu warten
    queryClient.setQueryData<SessionRead>(key, (old) =>
      old
        ? {
            ...old,
            exercises: old.exercises.map((e) =>
              e.id === se.id
                ? {
                    ...e,
                    sets: [
                      ...e.sets,
                      {
                        id: tempId,
                        session_exercise_id: se.id,
                        exercise_id: se.exercise_id,
                        set_number: e.sets.length + 1,
                        rest_sec: null,
                        rpe: null,
                        completed_at: new Date().toISOString(),
                        records: [],
                        ...v,
                      },
                    ],
                  }
                : e,
            ),
          }
        : old,
    )
    if (!v.is_warmup && !session.finished_at) startRest(restSec)
    addSet.mutate(
      { seId: se.id, data: v },
      {
        onSuccess: (saved) => {
          if (saved.records.length > 0) {
            onRecords(saved.id, saved.records)
            onRecordMoment({
              exercise: exercise?.name ?? 'Übung',
              records: saved.records,
              weight: v.weight_kg,
              reps: v.reps,
              e1: v.weight_kg * (1 + v.reps / 30),
            })
            toast.success(`Neuer Rekord: ${saved.records.map((n) => `${n}RM`).join(', ')}`)
          }
        },
        onError: (e) => {
          // Nur den optimistischen Satz entfernen, andere noch ausstehende Sätze bleiben erhalten
          queryClient.setQueryData<SessionRead>(key, (old) =>
            old
              ? {
                  ...old,
                  exercises: old.exercises.map((x) =>
                    x.id === se.id
                      ? { ...x, sets: x.sets.filter((s) => s.id !== tempId) }
                      : x,
                  ),
                }
              : old,
          )
          const detail =
            loadType === 'time' ? `${v.reps} s` : `${v.reps} × ${formatWeight(v.weight_kg)} kg`
          toast.error(`Satz nicht gespeichert (${detail}): ${errorMessage(e)}`)
        },
        onSettled: refresh,
      },
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/exercises/$exerciseId"
            params={{ exerciseId: String(se.exercise_id) }}
            className="text-lg font-semibold"
          >
            {exercise?.name ?? `Übung ${se.exercise_id}`}
          </Link>
          <button
            type="button"
            aria-label="Übung entfernen"
            className="rounded-md p-2 hover:bg-accent"
            onClick={() => {
              if (confirm('Übung mit allen Sätzen aus dieser Session entfernen?')) {
                deleteSe.mutate({ seId: se.id }, { onSuccess: refresh, onError: showError })
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <PermanentNote exerciseId={se.exercise_id} />
        {se.sets.length > 0 && (
          <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem_auto] gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="text-center">Satz</span>
            <span>Letztes Mal</span>
            <span>Heute</span>
            <span className="text-right">Δ e1RM</span>
            <span />
          </div>
        )}
        <ul className="divide-y">
          {se.sets.map((s) => (
            <SetRow
              key={s.id}
              set={s}
              prev={s.is_warmup ? undefined : prevSets[s.set_number - 1]}
              records={recordsBySet[s.id] ?? []}
              weightStep={weightStep}
              loadType={loadType}
              onUpdate={(v) =>
                updateSet.mutate(
                  { setId: s.id, data: v },
                  { onSuccess: refresh, onError: showError },
                )
              }
              onDelete={() =>
                deleteSet.mutate({ setId: s.id }, { onSuccess: refresh, onError: showError })
              }
            />
          ))}
        </ul>
        <SetEntry
          key={`${se.id}-${se.sets.length}`}
          initialReps={prefill.reps}
          initialWeight={prefill.weight}
          weightStep={weightStep}
          loadType={loadType}
          onSubmit={log}
        />
        <Textarea
          aria-label="Session-Memo"
          placeholder="Memo für diese Session"
          rows={1}
          defaultValue={se.note}
          onBlur={(e) => {
            if (e.target.value !== se.note) {
              updateSe.mutate(
                { seId: se.id, data: { note: e.target.value } },
                { onSuccess: refresh, onError: showError },
              )
            }
          }}
        />
      </CardContent>
    </Card>
  )
}

export function WorkoutPage() {
  const { sessionId } = useParams({ strict: false }) as { sessionId: string }
  const id = Number(sessionId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session, isLoading, error } = useGetSessionDetail(id)
  const exercises = useListExercises({ limit: 200, include_inactive: true })
  const today = useToday({ weekday: apiWeekday() })
  const addExercise = useAddSessionExercise()
  const finish = useFinishSession()
  const remove = useDeleteSession()
  const endSession = useActiveSession((s) => s.endSession)
  const defaultRest = useSettings((s) => s.defaultRestSec)
  const [picker, setPicker] = useState(false)
  const [recordsBySet, setRecordsBySet] = useState<Record<number, number[]>>({})
  const [moment, setMoment] = useState<RecordMomentData | null>(null)

  if (isLoading) return <Spinner />
  if (error || !session) {
    return (
      <>
        <PageHeader title="Workout" back="/" />
        <EmptyState title="Session nicht gefunden" />
      </>
    )
  }

  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]))
  const planned = new Map(
    (today.data?.day?.exercises ?? []).map((e) => [e.exercise_id, e] as const),
  )
  const finished = session.finished_at != null
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getGetSessionDetailQueryKey(id),
    })

  return (
    <>
      {moment && <RecordMoment data={moment} onClose={() => setMoment(null)} />}
      <PageHeader
        title={finished ? 'Session' : 'Workout läuft'}
        back={finished ? '/history' : '/'}
        actions={
          !finished && (
            <Button
              size="sm"
              disabled={finish.isPending}
              onClick={() =>
                finish.mutate(
                  { sessionId: id },
                  {
                    onSuccess: async () => {
                      endSession()
                      useActiveSession.getState().clearRest()
                      await queryClient.invalidateQueries()
                      toast.success('Training beendet')
                      void navigate({ to: '/' })
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Beenden
            </Button>
          )
        }
      />
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          {session.cycle_name && (
            <span className="font-semibold text-foreground">{session.cycle_name} · </span>
          )}
          {formatDateTime(session.started_at)} ·{' '}
          {durationLabel(session.started_at, session.finished_at)}
        </p>
        {session.exercises.length === 0 && (
          <EmptyState title="Noch keine Übungen" hint="Füge deine erste Übung hinzu." />
        )}
        {session.exercises.map((se) => {
          const plan = planned.get(se.exercise_id)
          const last = plan?.last_sets.filter((s) => !s.is_warmup).at(-1) ?? null
          return (
            <ExerciseCard
              key={se.id}
              se={se}
              exercise={byId.get(se.exercise_id)}
              restSec={plan?.target_rest_sec ?? defaultRest}
              todayLast={last}
              prevSets={plan?.last_sets.filter((x) => !x.is_warmup) ?? []}
              recordsBySet={recordsBySet}
              onRecords={(setId, recs) => setRecordsBySet((m) => ({ ...m, [setId]: recs }))}
              onRecordMoment={setMoment}
              session={session}
            />
          )
        })}
        <Button variant="outline" className="w-full" onClick={() => setPicker(true)}>
          <Plus className="h-4 w-4" /> Übung hinzufügen
        </Button>
        <SessionNote session={session} />
        {finished && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              if (confirm('Session endgültig löschen?')) {
                remove.mutate(
                  { sessionId: id },
                  {
                    onSuccess: async () => {
                      await queryClient.invalidateQueries()
                      void navigate({ to: '/history' })
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            }}
          >
            Session löschen
          </Button>
        )}
      </div>
      <ExercisePicker
        open={picker}
        onOpenChange={setPicker}
        onPick={(ex) =>
          addExercise.mutate(
            { sessionId: id, data: { exercise_id: ex.id } },
            {
              onSuccess: refresh,
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      />
    </>
  )
}
