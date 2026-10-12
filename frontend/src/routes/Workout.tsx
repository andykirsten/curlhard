import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  getGetSessionDetailQueryKey,
  getGetSessionPreviousQueryKey,
  useAddSessionExercise,
  useAddSet,
  useDeleteSession,
  useDeleteSessionExercise,
  useDeleteSet,
  useExerciseSummary,
  useFinishSession,
  useGetNote,
  useGetSessionDetail,
  useGetSessionPrevious,
  useListExercises,
  usePutNote,
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
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { ExerciseStrip } from '@/components/workout/ExerciseStrip'
import { InputDock } from '@/components/workout/InputDock'
import { SetTable, type ActiveRow } from '@/components/workout/SetTable'
import { VolumeBar } from '@/components/workout/VolumeBar'
import { WorkoutHeader } from '@/components/workout/WorkoutHeader'
import { errorMessage } from '@/lib/query'
import { formatWeight } from '@/lib/weight'
import { compareLabel, e1rm, exerciseProgress, exerciseVolume } from '@/lib/workout'
import { useActiveSession } from '@/stores/activeSession'
import { useSettings } from '@/stores/settings'

interface RecordMomentData {
  exercise: string
  records: number[]
  setNumber: number
  weight: number
  reps: number
  e1: number
  /** Zuwachs zum bisherigen Bestwert (e1RM), falls bekannt */
  gain: number | null
}

/** Vollbild-Moment bei neuem Rekord (Design „Rekord-Moment“). */
function RecordMoment({ data, onClose }: { data: RecordMomentData; onClose: () => void }) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col justify-between bg-primary p-6 text-primary-foreground"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, rgba(0,0,0,0.08) 0 24px, transparent 24px 48px)',
          }}
        >
          <Dialog.Title className="text-sm font-semibold uppercase tracking-widest opacity-80">
            Neuer Rekord · {data.exercise}
          </Dialog.Title>
          <div>
            <p aria-hidden className="font-display text-7xl uppercase leading-none">
              Neuer
              <br />
              Rekord
            </p>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] opacity-80">
              Satz {data.setNumber}
            </p>
            <p className="mt-1 font-display text-5xl tabular-nums">
              {formatWeight(data.weight)} kg × {data.reps}
            </p>
            <p className="mt-2 text-lg tabular-nums opacity-90">
              e1RM {formatWeight(Math.round(data.e1 * 10) / 10)} kg
              {data.gain != null && data.gain > 0 && (
                <> · +{formatWeight(Math.round(data.gain * 10) / 10)} kg zum Bestwert</>
              )}
              {' · '}
              {data.records.map((n) => `${n}RM`).join(' · ')}
            </p>
          </div>
          <Button variant="secondary" size="lg" className="h-14 w-full uppercase" onClick={onClose}>
            Weiter pumpen
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

function ExerciseFocus({
  se,
  index,
  total,
  nextName,
  exercise,
  restSec,
  prevSets,
  prevLabel,
  recordsBySet,
  onRecords,
  onRecordMoment,
  onGo,
  onAddExercise,
  session,
}: {
  se: SessionExerciseRead
  index: number
  total: number
  nextName: string | null
  exercise: ExerciseRead | undefined
  restSec: number
  /** Arbeitssätze des letzten Trainings desselben Plantags, Index = Arbeitssatz-Nr. - 1 */
  prevSets: LastSet[]
  /** Herkunft der Vergleichswerte, z. B. „Letztes Mal: Tag 2 · Mo, 05.10.“ */
  prevLabel: string
  recordsBySet: Record<number, number[]>
  onRecords: (setId: number, records: number[]) => void
  onRecordMoment: (moment: RecordMomentData) => void
  onGo: (delta: 1 | -1) => void
  onAddExercise: () => void
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
  const summary = useExerciseSummary(se.exercise_id)
  const note = useGetNote(se.exercise_id)
  const loadType = exercise?.load_type ?? 'weight'
  const finished = session.finished_at != null
  const name = exercise?.name ?? `Übung ${se.exercise_id}`

  const [notesOpen, setNotesOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState<SetRead | null>(null)

  const working = se.sets.filter((s) => !s.is_warmup)
  const lastSet = working.at(-1)
  const fallback = summary.data?.last_session?.best_set
  const source = prevSets[working.length] ?? lastSet
  const prefill = source
    ? { reps: source.reps, weight: source.weight_kg }
    : { reps: fallback?.reps ?? 8, weight: fallback?.weight_kg ?? 20 }

  // Dock-Werte: werden nach jedem Satz (bzw. wenn Vergleichsdaten eintreffen) neu vorbelegt
  const seedKey = `${se.id}:${se.sets.length}:${prevSets.length}:${fallback ? 1 : 0}`
  const [seed, setSeed] = useState(seedKey)
  const [weight, setWeight] = useState(prefill.weight)
  const [reps, setReps] = useState(prefill.reps)
  const [warmup, setWarmup] = useState(false)
  if (seed !== seedKey) {
    setSeed(seedKey)
    setWeight(prefill.weight)
    setReps(prefill.reps)
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const showError = (e: unknown) => toast.error(errorMessage(e))

  const log = async (v: SetValues) => {
    const tempId = -Date.now()
    const bestBefore = summary.data?.e1rm ?? null
    const setNumber = working.length + 1
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
    setWarmup(false)
    addSet.mutate(
      { seId: se.id, data: v },
      {
        onSuccess: (saved) => {
          if (saved.records.length > 0) {
            const e1 = e1rm(v.weight_kg, v.reps)
            onRecords(saved.id, saved.records)
            onRecordMoment({
              exercise: name,
              records: saved.records,
              setNumber,
              weight: v.weight_kg,
              reps: v.reps,
              e1,
              gain: bestBefore != null ? e1 - bestBefore : null,
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
                    x.id === se.id ? { ...x, sets: x.sets.filter((s) => s.id !== tempId) } : x,
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

  const active: ActiveRow | null = finished
    ? null
    : {
        number: working.length + 1,
        reps,
        weight_kg: loadType === 'time' ? 0 : weight,
        is_warmup: warmup,
        prev: warmup ? undefined : prevSets[working.length],
      }

  // Wischen wechselt die Übung (horizontal, > 60 px)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const volumeToday = exerciseVolume(se.sets, loadType)
  const volumeLast = exerciseVolume(prevSets, loadType)
  const memo = note.data?.note?.trim()

  return (
    <div
      className="touch-pan-y"
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const start = swipe.current
        swipe.current = null
        if (!start) return
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        if (Math.abs(dx) > 60 && Math.abs(dy) < 40) onGo(dx < 0 ? 1 : -1)
      }}
    >
      <VolumeBar
        exercise={name}
        today={volumeToday}
        last={volumeLast}
        unit={loadType === 'time' ? 's' : 'kg'}
      />
      <section aria-label="Übung" className="border-t px-5 pt-3">
        <div className="flex items-center justify-between gap-3 text-[13px] font-semibold text-muted-foreground">
          {index > 0 ? (
            <button type="button" aria-label="Vorherige Übung" onClick={() => onGo(-1)}>
              ‹ Übung {index + 1} / {total}
            </button>
          ) : (
            <span>
              Übung {index + 1} / {total}
            </span>
          )}
          {nextName ? (
            <button type="button" className="truncate text-right" onClick={() => onGo(1)}>
              Danach: {nextName}
            </button>
          ) : (
            !finished && (
              <button type="button" onClick={onAddExercise}>
                + Übung hinzufügen
              </button>
            )
          )}
        </div>
        <div className="mt-1 flex items-start justify-between gap-2">
          <h2 className="font-display text-[44px] uppercase leading-none" data-testid="exercise-title">
            {name}
          </h2>
          <button
            type="button"
            aria-label="Übungsmenü"
            className="-mr-2 mt-1 rounded-md p-2 hover:bg-accent"
            onClick={() => setMenuOpen(true)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          aria-label="Memos bearbeiten"
          className="mt-1 block w-full truncate text-left text-sm font-medium italic text-muted-foreground"
          onClick={() => setNotesOpen(true)}
        >
          {memo ? `Memo: ${memo}` : se.note ? `Session-Memo: ${se.note}` : 'Memo hinzufügen'}
        </button>
        <p
          className="mt-1 mb-2 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
          data-testid="prev-source"
        >
          {prevLabel}
        </p>
        <SetTable
          sets={se.sets}
          prevSets={prevSets}
          active={active}
          loadType={loadType}
          recordsBySet={recordsBySet}
          compact={!finished}
          onSelect={setEditing}
        />
      </section>

      {!finished && (
        <InputDock
          weight={weight}
          reps={reps}
          warmup={warmup}
          weightStep={weightStep}
          loadType={loadType}
          onWeight={setWeight}
          onReps={setReps}
          onWarmup={setWarmup}
          onSubmit={() =>
            void log({
              reps,
              weight_kg: loadType === 'time' ? 0 : weight,
              is_warmup: warmup,
            })
          }
        />
      )}

      <Sheet open={notesOpen} onOpenChange={setNotesOpen} title={`Memos · ${name}`}>
        <div className="space-y-3 pb-2">
          <PermanentNote exerciseId={se.exercise_id} />
          <Textarea
            aria-label="Session-Memo"
            placeholder="Memo für diese Session"
            rows={2}
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
          <SessionNote session={session} />
        </div>
      </Sheet>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={name}>
        <div className="flex flex-col gap-2 pb-2">
          <Button variant="outline" asChild>
            <Link to="/exercises/$exerciseId" params={{ exerciseId: String(se.exercise_id) }}>
              Übungsdetails
            </Link>
          </Button>
          {!finished && (
            <Button
              variant="outline"
              onClick={() => {
                setMenuOpen(false)
                onAddExercise()
              }}
            >
              <Plus className="h-4 w-4" /> Übung hinzufügen
            </Button>
          )}
          <Button
            variant="destructive"
            aria-label="Übung entfernen"
            onClick={() => {
              if (confirm('Übung mit allen Sätzen aus dieser Session entfernen?')) {
                setMenuOpen(false)
                deleteSe.mutate({ seId: se.id }, { onSuccess: refresh, onError: showError })
              }
            }}
          >
            Übung entfernen
          </Button>
        </div>
      </Sheet>

      <Sheet open={editing != null} onOpenChange={(o) => !o && setEditing(null)} title="Satz bearbeiten">
        {editing && (
          <div className="space-y-4 pb-2">
            <SetEntry
              initialReps={editing.reps}
              initialWeight={editing.weight_kg}
              initialWarmup={editing.is_warmup}
              weightStep={weightStep}
              loadType={loadType}
              submitLabel="Speichern"
              onSubmit={(v) => {
                updateSet.mutate(
                  { setId: editing.id, data: v },
                  { onSuccess: refresh, onError: showError },
                )
                setEditing(null)
              }}
            />
            <Button
              variant="destructive"
              className="w-full"
              aria-label="Satz löschen"
              onClick={() => {
                deleteSet.mutate({ setId: editing.id }, { onSuccess: refresh, onError: showError })
                setEditing(null)
              }}
            >
              Satz löschen
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

export function WorkoutPage() {
  const { sessionId } = useParams({ strict: false }) as { sessionId: string }
  const id = Number(sessionId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session, isLoading, error } = useGetSessionDetail(id)
  const exercises = useListExercises({ limit: 200, include_inactive: true })
  // Vergleichswerte und Ziele kommen vom Plantag der Session, nicht vom heutigen Wochentag
  const previous = useGetSessionPrevious(id)
  const addExercise = useAddSessionExercise()
  const finish = useFinishSession()
  const remove = useDeleteSession()
  const endSession = useActiveSession((s) => s.endSession)
  const defaultRest = useSettings((s) => s.defaultRestSec)
  const [picker, setPicker] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
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
    (previous.data?.exercises ?? []).map((e) => [e.exercise_id, e] as const),
  )
  const finished = session.finished_at != null
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getGetSessionDetailQueryKey(id),
    })

  const count = session.exercises.length
  const index = Math.min(focusIndex, Math.max(0, count - 1))
  const se = session.exercises[index]
  const plan = se ? planned.get(se.exercise_id) : undefined
  const next = session.exercises[index + 1]
  const go = (delta: 1 | -1) =>
    setFocusIndex(Math.min(Math.max(0, index + delta), Math.max(0, count - 1)))

  const onFinish = () =>
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

  return (
    <>
      {moment && <RecordMoment data={moment} onClose={() => setMoment(null)} />}
      {/* Kopf + Übungs-Leiste bleiben beim Scrollen sichtbar */}
      <div className="sticky top-0 z-10 bg-background/95 pb-2 backdrop-blur">
        {finished ? (
          <PageHeader title="Session" back="/history" />
        ) : (
          <WorkoutHeader
            startedAt={session.started_at}
            pending={finish.isPending}
            onFinish={onFinish}
          />
        )}
        {count > 0 && (
          <ExerciseStrip
            items={session.exercises.map((x) => ({
              id: x.id,
              name: byId.get(x.exercise_id)?.name ?? `Übung ${x.exercise_id}`,
              progress: exerciseProgress(x.sets, planned.get(x.exercise_id)?.target_sets),
            }))}
            selected={index}
            onSelect={setFocusIndex}
            onAdd={finished ? undefined : () => setPicker(true)}
          />
        )}
      </div>
      <div className={finished ? 'pb-6' : 'pb-80'}>
        {session.cycle_name && (
          <p className="px-5 pb-2 text-sm font-semibold text-muted-foreground">
            {session.cycle_name}
          </p>
        )}
        {count === 0 && (
          <div className="space-y-3 px-5">
            <EmptyState title="Noch keine Übungen" hint="Füge deine erste Übung hinzu." />
            <Button variant="outline" className="w-full" onClick={() => setPicker(true)}>
              <Plus className="h-4 w-4" /> Übung hinzufügen
            </Button>
          </div>
        )}
        {se && (
          <ExerciseFocus
            key={se.id}
            se={se}
            index={index}
            total={count}
            nextName={next ? (byId.get(next.exercise_id)?.name ?? `Übung ${next.exercise_id}`) : null}
            exercise={byId.get(se.exercise_id)}
            restSec={plan?.target_rest_sec ?? defaultRest}
            prevSets={plan?.sets.filter((x) => !x.is_warmup) ?? []}
            prevLabel={
              previous.isPending ? ' ' : compareLabel(plan, previous.data?.plan_day_name)
            }
            recordsBySet={recordsBySet}
            onRecords={(setId, recs) => setRecordsBySet((m) => ({ ...m, [setId]: recs }))}
            onRecordMoment={setMoment}
            onGo={go}
            onAddExercise={() => setPicker(true)}
            session={session}
          />
        )}
        {finished && (
          <div className="mt-6 space-y-3 px-5">
            <SessionNote session={session} />
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
          </div>
        )}
      </div>
      <ExercisePicker
        open={picker}
        onOpenChange={setPicker}
        onPick={(ex) =>
          addExercise.mutate(
            { sessionId: id, data: { exercise_id: ex.id } },
            {
              onSuccess: async () => {
                await Promise.all([
                  refresh(),
                  queryClient.invalidateQueries({ queryKey: getGetSessionPreviousQueryKey(id) }),
                ])
                // Neue Übung ans Ende der Session springen lassen
                setFocusIndex(count)
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      />
    </>
  )
}
