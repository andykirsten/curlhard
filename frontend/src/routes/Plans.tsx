import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  addPlanExercise,
  createDay,
  createPlan,
  listExercises,
  useActivatePlan,
  useCopyPublicPlan,
  useCreatePlan,
  useDeletePlan,
  useDuplicatePlan,
  useListPlans,
  useListPublicPlans,
  type PublicPlanSummary,
} from '@/api'
import { CycleCard } from '@/components/CycleCard'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { weekdaysLabel } from '@/lib/dates'
import { buildExamplePlan } from '@/lib/examplePlan'
import { errorMessage } from '@/lib/query'

export function PlansPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useListPlans()
  const create = useCreatePlan()
  const activate = useActivatePlan()
  const duplicate = useDuplicatePlan()
  const remove = useDeletePlan()
  const publicPlans = useListPublicPlans()
  const copyPublic = useCopyPublicPlan()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'mine' | 'public'>('mine')
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
        const day = await createDay(plan.id, { name: d.name, weekdays: d.weekdays })
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
        <CycleCard />

        <Segmented
          aria-label="Ansicht"
          value={tab}
          options={[
            { value: 'mine', label: 'Meine Pläne' },
            { value: 'public', label: 'Öffentlich' },
          ]}
          onChange={(v) => setTab(v as 'mine' | 'public')}
        />

        {tab === 'public' && (
          <PublicPlanList
            plans={publicPlans.data}
            isLoading={publicPlans.isLoading}
            busy={copyPublic.isPending}
            onCopy={(planId) =>
              copyPublic.mutate(
                { planId },
                {
                  onSuccess: (plan) => {
                    toast.success('Plan übernommen')
                    void queryClient.invalidateQueries()
                    void navigate({ to: '/plans/$planId', params: { planId: String(plan.id) } })
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          />
        )}

        {tab === 'mine' && (
          <>
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
              <Button
                type="submit"
                size="icon"
                aria-label="Plan anlegen"
                disabled={create.isPending}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </form>

            {isLoading && <Spinner />}
            {data?.length === 0 && (
              <EmptyState
                title="Noch keine Pläne"
                hint="Lege oben deinen ersten Trainingsplan an – oder starte mit einem Beispielplan."
                action={
                  <Button
                    variant="secondary"
                    disabled={seeding}
                    onClick={() => void createExample()}
                  >
                    Beispielplan anlegen
                  </Button>
                }
              />
            )}
            <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
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
                        <div className="flex gap-1">
                          {plan.is_public && <Badge variant="secondary">Öffentlich</Badge>}
                          {plan.is_active && <Badge>Aktiv</Badge>}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {plan.days.length === 0
                          ? 'Keine Trainingstage'
                          : plan.days
                              .map((d) => `${d.name} (${weekdaysLabel(d.weekdays, true)})`)
                              .join(' · ')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {!plan.is_active && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={activate.isPending}
                            onClick={() => activate.mutate({ planId: plan.id }, opts)}
                          >
                            Aktivieren
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={duplicate.isPending}
                          onClick={() => duplicate.mutate({ planId: plan.id }, opts)}
                        >
                          <Copy className="h-4 w-4" /> Duplizieren
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={remove.isPending}
                          aria-label={`Plan ${plan.name} löschen`}
                          onClick={() => {
                            if (
                              confirm(
                                `Plan „${plan.name}“ löschen? Bisherige Trainings bleiben erhalten.`,
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
          </>
        )}
      </div>
    </>
  )
}

function PublicPlanList({
  plans,
  isLoading,
  busy,
  onCopy,
}: {
  plans: PublicPlanSummary[] | undefined
  isLoading: boolean
  busy: boolean
  onCopy: (planId: number) => void
}) {
  if (isLoading) return <Spinner />
  if (plans?.length === 0) {
    return (
      <EmptyState
        title="Keine öffentlichen Pläne"
        hint="Sobald andere Nutzer Pläne öffentlich teilen, erscheinen sie hier."
      />
    )
  }
  return (
    <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
      {plans?.map((plan) => (
        <li key={plan.id}>
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Avatar name={plan.author.display_name} src={plan.author.avatar_url} size="sm" />
                <p className="min-w-0 truncate text-sm text-muted-foreground">
                  {plan.author.display_name}
                </p>
              </div>
              <Link
                to="/plans/public/$planId"
                params={{ planId: String(plan.id) }}
                className="block truncate text-lg font-semibold"
              >
                {plan.name}
              </Link>
              {plan.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {plan.day_count} {plan.day_count === 1 ? 'Trainingstag' : 'Trainingstage'} ·{' '}
                {plan.exercise_count} {plan.exercise_count === 1 ? 'Übung' : 'Übungen'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/plans/public/$planId" params={{ planId: String(plan.id) }}>
                    Ansehen
                  </Link>
                </Button>
                <Button size="sm" disabled={busy} onClick={() => onCopy(plan.id)}>
                  Übernehmen
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
