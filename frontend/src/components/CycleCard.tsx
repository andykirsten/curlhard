import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Play, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useActivateCycle,
  useCreateCycle,
  useDeleteCycle,
  useEndCycle,
  useListCycles,
  useListPlans,
  useUpdateCycle,
  type CycleRead,
} from '@/api'
import { EmptyState } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet } from '@/components/ui/sheet'
import { cycleWeekLabel, localIsoDate, todayIso } from '@/lib/cycle'
import { formatShortDate } from '@/lib/dates'
import { errorMessage } from '@/lib/query'

interface CycleFormValues {
  name: string
  note: string
  startDate: string
  endDate: string
  planId: string
}

function CycleForm({
  cycle,
  plans,
  pending,
  submitLabel,
  onSubmit,
}: {
  cycle: CycleRead | null
  plans: { id: number; name: string }[]
  pending: boolean
  submitLabel: string
  onSubmit: (values: CycleFormValues) => void
}) {
  const [values, setValues] = useState<CycleFormValues>({
    name: cycle?.name ?? '',
    note: cycle?.note ?? '',
    startDate: cycle?.start_date ?? todayIso(),
    endDate: cycle?.end_date ?? '',
    planId: cycle?.plan_id != null ? String(cycle.plan_id) : '',
  })
  const set = (patch: Partial<CycleFormValues>) => setValues((v) => ({ ...v, ...patch }))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(values)
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="cycle-name">Name</Label>
        <Input
          id="cycle-name"
          maxLength={120}
          required
          placeholder="z. B. Kraftausdauer"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="cycle-start">Start</Label>
          <Input
            id="cycle-start"
            type="date"
            required
            value={values.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cycle-end">Ende (optional)</Label>
          <Input
            id="cycle-end"
            type="date"
            min={values.startDate}
            value={values.endDate}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cycle-plan">Plan</Label>
        <Select
          id="cycle-plan"
          value={values.planId}
          onChange={(e) => set({ planId: e.target.value })}
        >
          <option value="">Kein Plan</option>
          {plans.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cycle-note">Notiz</Label>
        <Textarea
          id="cycle-note"
          maxLength={2000}
          value={values.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}

function dateRange(cycle: CycleRead): string {
  const end = cycle.end_date ? formatShortDate(cycle.end_date) : 'offen'
  return `${formatShortDate(cycle.start_date)} – ${end}`
}

/** Karte „Zyklus“ auf der Plan-Seite: aktiver Zyklus, Editor und frühere Zyklen. */
export function CycleCard() {
  const queryClient = useQueryClient()
  const cycles = useListCycles()
  const plans = useListPlans()
  const createCycle = useCreateCycle()
  const updateCycle = useUpdateCycle()
  const deleteCycle = useDeleteCycle()
  const activateCycle = useActivateCycle()
  const endCycle = useEndCycle()
  const [editor, setEditor] = useState<{ cycle: CycleRead | null } | null>(null)

  const refresh = () => void queryClient.invalidateQueries()
  const fail = (e: unknown) => toast.error(errorMessage(e))
  const active = cycles.data?.find((c) => c.is_active)
  const past = cycles.data?.filter((c) => !c.is_active) ?? []

  const save = (values: CycleFormValues) => {
    if (values.endDate && values.endDate < values.startDate) {
      toast.error('Das Enddatum liegt vor dem Startdatum.')
      return
    }
    const fields = {
      name: values.name.trim(),
      note: values.note,
      start_date: values.startDate,
      end_date: values.endDate || null,
      plan_id: values.planId ? Number(values.planId) : null,
    }
    if (editor?.cycle) {
      updateCycle.mutate(
        { cycleId: editor.cycle.id, data: fields },
        {
          onSuccess: () => {
            setEditor(null)
            toast.success('Zyklus gespeichert')
            refresh()
          },
          onError: fail,
        },
      )
    } else {
      createCycle.mutate(
        { data: { ...fields, activate: true } },
        {
          onSuccess: () => {
            setEditor(null)
            toast.success('Zyklus gestartet')
            refresh()
          },
          onError: fail,
        },
      )
    }
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Zyklus
          </p>
          {active ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-lg font-semibold">{active.name}</p>
                <Badge>{cycleWeekLabel(active.start_date, active.end_date)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {active.plan_name ? `Plan: ${active.plan_name}` : 'Kein Plan verknüpft'} ·{' '}
                {active.session_count} {active.session_count === 1 ? 'Training' : 'Trainings'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditor({ cycle: active })}>
                  <Pencil className="h-4 w-4" /> Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={endCycle.isPending}
                  onClick={() =>
                    endCycle.mutate(
                      { cycleId: active.id, data: { end_date: localIsoDate() } },
                      { onSuccess: refresh, onError: fail },
                    )
                  }
                >
                  Beenden
                </Button>
              </div>
            </>
          ) : (
            cycles.data && (
              <EmptyState
                title="Kein aktiver Zyklus"
                hint="Ein Zyklus fasst mehrere Wochen zusammen, z. B. „Kraftausdauer“. Neue Trainings werden automatisch zugeordnet."
                action={
                  <Button size="sm" onClick={() => setEditor({ cycle: null })}>
                    <Play className="h-4 w-4" /> Zyklus starten
                  </Button>
                }
              />
            )
          )}

          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Frühere Zyklen
              </p>
              <ul className="divide-y rounded-lg border bg-card">
                {past.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dateRange(c)} · {c.session_count}{' '}
                        {c.session_count === 1 ? 'Training' : 'Trainings'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={activateCycle.isPending}
                        onClick={() =>
                          activateCycle.mutate(
                            { cycleId: c.id },
                            { onSuccess: refresh, onError: fail },
                          )
                        }
                      >
                        Aktivieren
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleteCycle.isPending}
                        aria-label={`Zyklus ${c.name} löschen`}
                        onClick={() => {
                          if (
                            confirm(
                              `Zyklus „${c.name}“ löschen? Bisherige Trainings bleiben erhalten.`,
                            )
                          ) {
                            deleteCycle.mutate(
                              { cycleId: c.id },
                              { onSuccess: refresh, onError: fail },
                            )
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={editor !== null}
        onOpenChange={(open) => !open && setEditor(null)}
        title={editor?.cycle ? 'Zyklus bearbeiten' : 'Zyklus starten'}
      >
        {editor && (
          <CycleForm
            key={editor.cycle?.id ?? 'new'}
            cycle={editor.cycle}
            plans={plans.data ?? []}
            pending={createCycle.isPending || updateCycle.isPending}
            submitLabel={editor.cycle ? 'Speichern' : 'Zyklus starten'}
            onSubmit={save}
          />
        )}
      </Sheet>
    </>
  )
}
