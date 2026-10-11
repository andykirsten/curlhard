import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useCreateExercise,
  useListEquipment,
  useListExercises,
  useListMuscleGroups,
  useMe,
  useUpdateExercise,
  type ExerciseRead,
} from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet } from '@/components/ui/sheet'
import { errorMessage } from '@/lib/query'

const LOAD_TYPES = [
  ['weight', 'Gewicht'],
  ['bodyweight', 'Körpergewicht (+ Zusatz)'],
  ['assisted', 'Unterstützt (Körpergewicht − Hilfe)'],
  ['time', 'Zeit'],
] as const

type LoadType = (typeof LOAD_TYPES)[number][0]

function ExerciseSheet({
  exercise,
  isAdmin,
  onClose,
}: {
  exercise: ExerciseRead | null
  isAdmin: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const muscles = useListMuscleGroups()
  const equipment = useListEquipment()
  const create = useCreateExercise()
  const update = useUpdateExercise()
  const [name, setName] = useState(exercise?.name ?? '')
  const [muscle, setMuscle] = useState<number | ''>(exercise?.primary_muscle_group_id ?? '')
  const [equip, setEquip] = useState<number | ''>(exercise?.equipment_id ?? '')
  const [loadType, setLoadType] = useState<LoadType>((exercise?.load_type as LoadType) ?? 'weight')
  const [global, setGlobal] = useState(false)

  const done = () => {
    void queryClient.invalidateQueries()
    onClose()
  }
  const fail = (e: unknown) => toast.error(errorMessage(e))
  const canEdit = !exercise || !exercise.is_global || isAdmin

  const submit = () => {
    if (!name.trim()) return
    const body = {
      name: name.trim(),
      primary_muscle_group_id: muscle === '' ? null : muscle,
      equipment_id: equip === '' ? null : equip,
      load_type: loadType,
    }
    if (exercise)
      update.mutate({ exerciseId: exercise.id, data: body }, { onSuccess: done, onError: fail })
    else create.mutate({ data: { ...body, is_global: global } }, { onSuccess: done, onError: fail })
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={exercise ? 'Übung bearbeiten' : 'Neue Übung'}
    >
      <div className="space-y-3 pb-2">
        <div className="space-y-1">
          <Label htmlFor="ex-name">Name</Label>
          <Input
            id="ex-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ex-muscle">Hauptmuskel</Label>
          <Select
            id="ex-muscle"
            value={muscle}
            disabled={!canEdit}
            onChange={(e) => setMuscle(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">–</option>
            {muscles.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ex-equip">Equipment</Label>
          <Select
            id="ex-equip"
            value={equip}
            disabled={!canEdit}
            onChange={(e) => setEquip(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">–</option>
            {equipment.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ex-load">Belastungsart</Label>
          <Select
            id="ex-load"
            value={loadType}
            disabled={!canEdit}
            onChange={(e) => setLoadType(e.target.value as LoadType)}
          >
            {LOAD_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        {!exercise && isAdmin && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={global}
              onChange={(e) => setGlobal(e.target.checked)}
            />
            Globale Übung (für alle Nutzer sichtbar)
          </label>
        )}
        {canEdit && (
          <Button
            className="w-full"
            onClick={submit}
            disabled={create.isPending || update.isPending}
          >
            Speichern
          </Button>
        )}
        {exercise && canEdit && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={() =>
              update.mutate(
                { exerciseId: exercise.id, data: { is_active: false } },
                { onSuccess: done, onError: fail },
              )
            }
          >
            Deaktivieren
          </Button>
        )}
      </div>
    </Sheet>
  )
}

export function ExercisesPage() {
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState<number | ''>('')
  const [equip, setEquip] = useState<number | ''>('')
  const [editing, setEditing] = useState<ExerciseRead | 'new' | null>(null)
  const me = useMe()
  const muscles = useListMuscleGroups()
  const equipment = useListEquipment()
  const { data, isLoading } = useListExercises({
    search: search || undefined,
    muscle_group: muscle === '' ? undefined : muscle,
    equipment: equip === '' ? undefined : equip,
    limit: 200,
  })
  const isAdmin = me.data?.role === 'admin'
  const muscleName = new Map((muscles.data ?? []).map((m) => [m.id, m.name]))

  return (
    <>
      <PageHeader
        title="Übungen"
        profile
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Neu
          </Button>
        }
      />
      <div className="space-y-3 p-4">
        <Input
          placeholder="Suchen …"
          aria-label="Übungen suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            aria-label="Muskelgruppe filtern"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Alle Muskeln</option>
            {muscles.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Equipment filtern"
            value={equip}
            onChange={(e) => setEquip(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Alles Equipment</option>
            {equipment.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        {isLoading && <Spinner />}
        {data?.length === 0 && (
          <EmptyState
            title="Keine Übungen gefunden"
            hint="Passe die Filter an oder lege eine eigene Übung an."
          />
        )}
        <ul className="divide-y rounded-lg border">
          {data?.map((ex) => (
            <li key={ex.id} className="flex items-center gap-2 pr-2">
              <Link
                to="/exercises/$exerciseId"
                params={{ exerciseId: String(ex.id) }}
                className="flex-1 px-3 py-3"
              >
                <div className="font-medium">{ex.name}</div>
                <div className="text-xs text-muted-foreground">
                  {ex.primary_muscle_group_id != null
                    ? muscleName.get(ex.primary_muscle_group_id)
                    : '–'}
                </div>
              </Link>
              {!ex.is_global && <Badge variant="secondary">eigene</Badge>}
              {(!ex.is_global || isAdmin) && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(ex)}>
                  Bearbeiten
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {editing && (
        <ExerciseSheet
          key={editing === 'new' ? 'new' : editing.id}
          exercise={editing === 'new' ? null : editing}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
