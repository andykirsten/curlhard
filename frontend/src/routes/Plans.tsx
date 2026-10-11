import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  addPlanExercise,
  createDay,
  createPlan,
  listExercises,
  useActivatePlan,
  useCreatePlan,
  useDeletePlan,
  useDuplicatePlan,
  useListPlans,
} from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { weekdayLabel } from '@/lib/dates'
import { buildExamplePlan } from '@/lib/examplePlan'
import { errorMessage } from '@/lib/query'

export function PlansPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useListPlans()
  const create = useCreatePlan()
  const activate = useActivatePlan()
  const duplicate = useDuplicatePlan()
  const remove = useDeletePlan()
  const [name, setName] = useState('')
  const [seeding, setSeeding] = useState(false)

  const createExample = async () => {
    setSeeding(true)
    try {
      const catalog = await listExercises({ limit: 200 })
      const days = buildExamplePlan(catalog)
      if (days.length === 0) return toast.error('Der Übungskatalog ist leer.')
      const plan = await createPlan({ name: 'Beispielplan (Push/Pull/Beine)' })
      for (const d of days) {
        const day = await createDay(plan.id, { name: d.name, weekday: d.weekday })
        for (const exerciseId of d.exerciseIds) {
          await addPlanExercise(day.id, { exercise_id: exerciseId })
        }
      }
      await queryClient.invalidateQueries()
      toast.success('Beispielplan angelegt')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSeeding(false)
    }
  }

  const refresh = () => queryClient.invalidateQueries()
  const opts = {
    onSuccess: refresh,
    onError: (e: unknown) => toast.error(errorMessage(e)),
  }

  return (
    <>
      <PageHeader title="Pläne" profile />
      <div className="space-y-4 p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            create.mutate(
              { data: { name: name.trim() } },
              {
                ...opts,
                onSuccess: () => {
                  setName('')
                  void refresh()
                },
              },
            )
          }}
        >
          <Input
            aria-label="Name des neuen Plans"
            placeholder="Neuer Plan, z. B. Push/Pull/Legs"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" size="icon" aria-label="Plan anlegen" disabled={create.isPending}>
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        {isLoading && <Spinner />}
        {data?.length === 0 && (
          <EmptyState
            title="Noch keine Pläne"
            hint="Lege oben deinen ersten Trainingsplan an – oder starte mit einem Beispielplan."
            action={
              <Button variant="secondary" disabled={seeding} onClick={() => void createExample()}>
                Beispielplan anlegen
              </Button>
            }
          />
        )}
        <ul className="space-y-3">
          {data?.map((plan) => (
            <li key={plan.id}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to="/plans/$planId"
                      params={{ planId: String(plan.id) }}
                      className="text-lg font-semibold"
                    >
                      {plan.name}
                    </Link>
                    {plan.is_active && <Badge>Aktiv</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.days.length === 0
                      ? 'Keine Trainingstage'
                      : plan.days
                          .map(
                            (d) =>
                              `${d.name} (${d.weekday == null ? weekdayLabel(null) : weekdayLabel(d.weekday).slice(0, 2)})`,
                          )
                          .join(' · ')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!plan.is_active && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => activate.mutate({ planId: plan.id }, opts)}
                      >
                        Aktivieren
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => duplicate.mutate({ planId: plan.id }, opts)}
                    >
                      <Copy className="h-4 w-4" /> Duplizieren
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Plan ${plan.name} löschen`}
                      onClick={() => {
                        if (
                          confirm(
                            `Plan „${plan.name}“ löschen? Bisherige Sessions bleiben erhalten.`,
                          )
                        ) {
                          remove.mutate({ planId: plan.id }, opts)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
