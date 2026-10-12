import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  getGetPlanQueryKey,
  useAddPlanExercise,
  useCreateDay,
  useDeleteDay,
  useDeletePlanExercise,
  useGetPlan,
  useListExercises,
  useOrderDays,
  useOrderExercises,
  useUpdateDay,
  useUpdatePlan,
  useUpdatePlanExercise,
  type PlanDayRead,
  type PlanExerciseRead,
  type PlanRead,
} from '@/api'
import { ExercisePicker } from '@/components/ExercisePicker'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { WEEKDAYS, WEEKDAYS_SHORT } from '@/lib/dates'
import { reorderIds } from '@/lib/reorder'
import { errorMessage } from '@/lib/query'

function useSortSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
}

function SortableRow({
  id,
  children,
}: {
  id: number
  children: (handle: React.ReactNode) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const handle = (
    <button
      type="button"
      aria-label="Zum Umsortieren ziehen"
      className="touch-none rounded-md p-2 text-muted-foreground"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-5 w-5" />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      {children(handle)}
    </li>
  )
}

function ExerciseEditor({
  pe,
  name,
  onClose,
  onSave,
}: {
  pe: PlanExerciseRead
  name: string
  onClose: () => void
  onSave: (v: Partial<PlanExerciseRead>) => void
}) {
  const [v, setV] = useState({
    target_sets: pe.target_sets,
    target_reps_min: pe.target_reps_min,
    target_reps_max: pe.target_reps_max,
    target_rest_sec: pe.target_rest_sec,
    note: pe.note,
  })
  const num = (key: keyof typeof v, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        inputMode="numeric"
        min={0}
        value={v[key] as number}
        onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })}
      />
    </div>
  )
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={name}>
      <div className="space-y-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          {num('target_sets', 'Sätze')}
          {num('target_rest_sec', 'Pause (s)')}
          {num('target_reps_min', 'Wdh. von')}
          {num('target_reps_max', 'Wdh. bis')}
        </div>
        <div className="space-y-1">
          <Label htmlFor="pe-note">Notiz</Label>
          <Input
            id="pe-note"
            value={v.note}
            onChange={(e) => setV({ ...v, note: e.target.value })}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => {
            onSave(v)
            onClose()
          }}
        >
          Speichern
        </Button>
      </div>
    </Sheet>
  )
}

/** Wochenübersicht (Design „Plan bearbeiten“): Tipp auf einen Tag springt zur Trainingskarte. */
function WeekGrid({ days }: { days: PlanDayRead[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Wochenplan
      </p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((short, i) => {
          const day = days.find((d) => d.weekday === i)
          return (
            <button
              key={short}
              type="button"
              disabled={!day}
              aria-label={day ? `${WEEKDAYS[i]}: ${day.name}` : `${WEEKDAYS[i]}: kein Training`}
              onClick={() =>
                document.getElementById(`day-${day!.id}`)?.scrollIntoView({ behavior: 'smooth' })
              }
              className={`flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-center ${
                day ? 'border-primary bg-primary/10' : 'bg-card text-muted-foreground'
              }`}
            >
              <span className="font-display text-sm uppercase">{short}</span>
              <span className="w-full truncate px-0.5 text-[10px] leading-none">
                {day ? day.name : '–'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayCard({
  day,
  plan,
  names,
  handle,
}: {
  day: PlanDayRead
  plan: PlanRead
  names: Map<number, string>
  handle: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const sensors = useSortSensors()
  const updateDay = useUpdateDay()
  const deleteDay = useDeleteDay()
  const addEx = useAddPlanExercise()
  const updateEx = useUpdatePlanExercise()
  const deleteEx = useDeletePlanExercise()
  const order = useOrderExercises()
  const [picker, setPicker] = useState(false)
  const [editing, setEditing] = useState<PlanExerciseRead | null>(null)
  const key = getGetPlanQueryKey(plan.id)
  const refresh = () => queryClient.invalidateQueries()
  const fail = (e: unknown) => toast.error(errorMessage(e))
  const ids = day.exercises.map((e) => e.id)

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const next = reorderIds(ids, Number(e.active.id), Number(e.over.id))
    // Optimistisch umsortieren, dann speichern
    const byId = new Map(day.exercises.map((x) => [x.id, x]))
    queryClient.setQueryData<PlanRead>(key, {
      ...plan,
      days: plan.days.map((d) =>
        d.id === day.id ? { ...d, exercises: next.map((id) => byId.get(id)!) } : d,
      ),
    })
    order.mutate({ dayId: day.id, data: { ids: next } }, { onSettled: refresh, onError: fail })
  }

  return (
    <Card id={`day-${day.id}`}>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1">
          {handle}
          <Input
            aria-label="Name des Trainingstags"
            defaultValue={day.name}
            onBlur={(e) => {
              const name = e.target.value.trim()
              if (name && name !== day.name)
                updateDay.mutate(
                  { dayId: day.id, data: { name } },
                  { onSuccess: refresh, onError: fail },
                )
            }}
          />
          <button
            type="button"
            aria-label="Trainingstag löschen"
            className="rounded-md p-2 hover:bg-accent"
            onClick={() => {
              if (confirm(`Tag „${day.name}“ löschen?`))
                deleteDay.mutate({ dayId: day.id }, { onSuccess: refresh, onError: fail })
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <Select
          aria-label="Wochentag"
          value={day.weekday ?? ''}
          onChange={(e) =>
            updateDay.mutate(
              {
                dayId: day.id,
                data: {
                  weekday: e.target.value === '' ? null : Number(e.target.value),
                },
              },
              { onSuccess: refresh, onError: fail },
            )
          }
        >
          <option value="">Frei wählbar</option>
          {WEEKDAYS.map((w, i) => (
            <option key={w} value={i}>
              {w}
            </option>
          ))}
        </Select>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {day.exercises.map((pe) => (
                <SortableRow key={pe.id} id={pe.id}>
                  {(h) => (
                    <div className="flex items-center gap-1 rounded-md border bg-background pr-1">
                      {h}
                      <button
                        type="button"
                        className="flex-1 py-2 text-left"
                        onClick={() => setEditing(pe)}
                        aria-label={`${names.get(pe.exercise_id) ?? 'Übung'} bearbeiten`}
                      >
                        <div className="font-medium">
                          {names.get(pe.exercise_id) ?? `Übung ${pe.exercise_id}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {pe.target_sets} × {pe.target_reps_min}–{pe.target_reps_max} ·{' '}
                          {pe.target_rest_sec} s
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label="Übung entfernen"
                        className="rounded-md p-2 hover:bg-accent"
                        onClick={() =>
                          deleteEx.mutate({ peId: pe.id }, { onSuccess: refresh, onError: fail })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </SortableRow>
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <Button variant="outline" className="w-full" onClick={() => setPicker(true)}>
          <Plus className="h-4 w-4" /> Übung hinzufügen
        </Button>
      </CardContent>
      <ExercisePicker
        open={picker}
        onOpenChange={setPicker}
        onPick={(ex) =>
          addEx.mutate(
            { dayId: day.id, data: { exercise_id: ex.id } },
            { onSuccess: refresh, onError: fail },
          )
        }
      />
      {editing && (
        <ExerciseEditor
          pe={editing}
          name={names.get(editing.exercise_id) ?? 'Übung'}
          onClose={() => setEditing(null)}
          onSave={(v) =>
            updateEx.mutate({ peId: editing.id, data: v }, { onSuccess: refresh, onError: fail })
          }
        />
      )}
    </Card>
  )
}

export function PlanEditorPage() {
  const { planId } = useParams({ strict: false }) as { planId: string }
  const id = Number(planId)
  const queryClient = useQueryClient()
  const sensors = useSortSensors()
  const { data: plan, isLoading } = useGetPlan(id)
  const exercises = useListExercises({ limit: 200, include_inactive: true })
  const updatePlan = useUpdatePlan()
  const createDay = useCreateDay()
  const orderDays = useOrderDays()
  const [dayName, setDayName] = useState('')

  if (isLoading) return <Spinner />
  if (!plan) return <EmptyState title="Plan nicht gefunden" />
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]))
  const refresh = () => queryClient.invalidateQueries()
  const fail = (e: unknown) => toast.error(errorMessage(e))
  const dayIds = plan.days.map((d) => d.id)

  const onDayDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const next = reorderIds(dayIds, Number(e.active.id), Number(e.over.id))
    const byId = new Map(plan.days.map((d) => [d.id, d]))
    queryClient.setQueryData<PlanRead>(getGetPlanQueryKey(id), {
      ...plan,
      days: next.map((i) => byId.get(i)!),
    })
    orderDays.mutate({ planId: id, data: { ids: next } }, { onSettled: refresh, onError: fail })
  }

  return (
    <>
      <PageHeader title="Plan bearbeiten" back="/plans" />
      <div className="space-y-4 p-4">
        <Input
          aria-label="Planname"
          defaultValue={plan.name}
          className="text-lg font-semibold"
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== plan.name)
              updatePlan.mutate(
                { planId: id, data: { name } },
                { onSuccess: refresh, onError: fail },
              )
          }}
        />
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <p className="font-semibold">Öffentlich teilen</p>
            <p className="text-sm text-muted-foreground">
              Andere Nutzer können diesen Plan ansehen und übernehmen.
            </p>
          </div>
          <Switch
            label="Öffentlich teilen"
            checked={plan.is_public}
            disabled={updatePlan.isPending}
            onCheckedChange={(is_public) =>
              updatePlan.mutate(
                { planId: id, data: { is_public } },
                { onSuccess: refresh, onError: fail },
              )
            }
          />
        </div>
        {plan.days.length > 0 && <WeekGrid days={plan.days} />}
        {plan.days.length === 0 && (
          <EmptyState
            title="Noch keine Trainingstage"
            hint="Füge z. B. „Push“, „Pull“ und „Beine“ hinzu."
          />
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDayDragEnd}>
          <SortableContext items={dayIds} strategy={verticalListSortingStrategy}>
            <ul className="space-y-4">
              {plan.days.map((day) => (
                <SortableRow key={day.id} id={day.id}>
                  {(h) => <DayCard day={day} plan={plan} names={names} handle={h} />}
                </SortableRow>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dayName.trim()) return
            createDay.mutate(
              { planId: id, data: { name: dayName.trim() } },
              {
                onSuccess: () => {
                  setDayName('')
                  void refresh()
                },
                onError: fail,
              },
            )
          }}
        >
          <Input
            aria-label="Name des neuen Trainingstags"
            placeholder="Neuer Trainingstag"
            value={dayName}
            onChange={(e) => setDayName(e.target.value)}
          />
          <Button type="submit" aria-label="Trainingstag hinzufügen">
            <Plus className="h-4 w-4" /> Tag
          </Button>
        </form>
      </div>
    </>
  )
}
