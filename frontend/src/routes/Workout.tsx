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
  useUpdateSessionExercise,
  useUpdateSet,
  type ExerciseRead,
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

function SetRow({
  set,
  records,
  weightStep,
  loadType,
  onUpdate,
  onDelete,
}: {
  set: SetRead
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
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-6 text-center text-sm text-muted-foreground">
        {set.is_warmup ? 'W' : set.set_number}
      </span>
      <span className="flex-1 font-medium tabular-nums">
        {loadType === 'time' ? `${set.reps} s` : `${set.reps} × ${formatWeight(set.weight_kg)} kg`}
      </span>
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
          put.mutate({ exerciseId, data: { note: draft } }, { onSuccess: () => setDraft(null) })
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
  recordsBySet,
  onRecords,
  session,
}: {
  se: SessionExerciseRead
  exercise: ExerciseRead | undefined
  restSec: number
  todayLast: { reps: number; weight_kg: number } | null
  recordsBySet: Record<number, number[]>
  onRecords: (setId: number, records: number[]) => void
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

  const log = (v: SetValues) => {
    const tempId = -Date.now()
    const previous = queryClient.getQueryData<SessionRead>(key)
    // Optimistic Update: Satz erscheint sofort, Timer startet ohne auf den Server zu warten
    if (previous) {
      queryClient.setQueryData<SessionRead>(key, {
        ...previous,
        exercises: previous.exercises.map((e) =>
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
      })
    }
    if (!v.is_warmup && !session.finished_at) startRest(restSec)
    addSet.mutate(
      { seId: se.id, data: v },
      {
        onSuccess: (saved) => {
          if (saved.records.length > 0) {
            onRecords(saved.id, saved.records)
            toast.success(`Neuer Rekord: ${saved.records.map((n) => `${n}RM`).join(', ')}`)
          }
        },
        onError: (e) => {
          if (previous) queryClient.setQueryData(key, previous)
          toast.error(errorMessage(e))
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
                deleteSe.mutate({ seId: se.id }, { onSuccess: refresh })
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <PermanentNote exerciseId={se.exercise_id} />
        <ul className="divide-y">
          {se.sets.map((s) => (
            <SetRow
              key={s.id}
              set={s}
              records={recordsBySet[s.id] ?? []}
              weightStep={weightStep}
              loadType={loadType}
              onUpdate={(v) => updateSet.mutate({ setId: s.id, data: v }, { onSuccess: refresh })}
              onDelete={() => deleteSet.mutate({ setId: s.id }, { onSuccess: refresh })}
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
                { onSuccess: refresh },
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
              recordsBySet={recordsBySet}
              onRecords={(setId, recs) => setRecordsBySet((m) => ({ ...m, [setId]: recs }))}
              session={session}
            />
          )
        })}
        <Button variant="outline" className="w-full" onClick={() => setPicker(true)}>
          <Plus className="h-4 w-4" /> Übung hinzufügen
        </Button>
        <Textarea
          aria-label="Session-Notiz"
          placeholder="Notiz zur Session"
          defaultValue={session.note}
          rows={2}
        />
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
