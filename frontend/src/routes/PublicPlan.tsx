import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useCopyPublicPlan, useGetPublicPlan } from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { weekdaysLabel } from '@/lib/dates'
import { errorMessage } from '@/lib/query'

/** Nur-Lese-Ansicht eines öffentlichen Plans von anderen Nutzern. */
export function PublicPlanPage() {
  const { planId } = useParams({ strict: false }) as { planId: string }
  const id = Number(planId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: plan, isLoading, isError } = useGetPublicPlan(id)
  const copy = useCopyPublicPlan()

  if (isLoading) return <Spinner />
  if (isError || !plan) {
    return (
      <>
        <PageHeader title="Plan" back="/plans" />
        <EmptyState title="Plan nicht gefunden" />
      </>
    )
  }

  // Die API liefert die Übungsnamen (exercise_names) mit, auch für private Übungen des Autors.
  // Fehlt ein Name, wird ein Platzhalter angezeigt.
  const exerciseCount = plan.days.reduce((sum, d) => sum + d.exercises.length, 0)

  const onCopy = () =>
    copy.mutate(
      { planId: plan.id },
      {
        onSuccess: (newPlan) => {
          toast.success('Plan übernommen')
          void queryClient.invalidateQueries()
          void navigate({ to: '/plans/$planId', params: { planId: String(newPlan.id) } })
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  return (
    <>
      <PageHeader title={plan.name} back="/plans" />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={plan.author.display_name} src={plan.author.avatar_url} size="md" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Von</p>
            <p className="truncate font-semibold">{plan.author.display_name}</p>
          </div>
        </div>

        {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
        <p className="text-sm text-muted-foreground">
          {plan.days.length} {plan.days.length === 1 ? 'Trainingstag' : 'Trainingstage'} ·{' '}
          {exerciseCount} {exerciseCount === 1 ? 'Übung' : 'Übungen'}
        </p>

        <Button className="w-full" disabled={copy.isPending} onClick={onCopy}>
          <Copy className="h-4 w-4" /> Übernehmen
        </Button>
        <p className="text-sm text-muted-foreground">
          Du erhältst eine eigene Kopie, die du frei anpassen kannst.
        </p>

        {plan.days.length === 0 && <EmptyState title="Noch keine Trainingstage" />}
        <ul className="space-y-4">
          {plan.days.map((day) => (
            <li key={day.id}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{day.name}</p>
                    <span className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                      {weekdaysLabel(day.weekdays)}
                    </span>
                  </div>
                  {day.exercises.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Übungen</p>
                  ) : (
                    <ul className="divide-y rounded-lg border bg-background">
                      {day.exercises.map((pe) => (
                        <li key={pe.id} className="flex items-center justify-between gap-2 p-3">
                          <span className="min-w-0 truncate">
                            {plan.exercise_names[String(pe.exercise_id)] ?? 'Übung'}
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {pe.target_sets} × {pe.target_reps_min}–{pe.target_reps_max}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
