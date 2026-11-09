import { useQueryClient } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { lazy, Suspense, useState } from 'react'
import { toast } from 'sonner'
import { useListBodyWeight, useSaveBodyWeight } from '@/api'
import { Spinner } from '@/components/Layout'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet } from '@/components/ui/sheet'
import { changeSince, formatChange } from '@/lib/bodyWeight'
import { errorMessage } from '@/lib/query'
import { formatWeight } from '@/lib/weight'

const BodyWeightChart = lazy(() => import('./charts/BodyWeightChart'))

/** Körpergewicht: aktueller Wert, Veränderung zu vor 4 Wochen, Verlauf und Eintragen. */
export function BodyWeightCard() {
  const queryClient = useQueryClient()
  const [today] = useState(() => new Date())
  const entries = useListBodyWeight({ from: format(subMonths(today, 12), 'yyyy-MM-dd') })
  const save = useSaveBodyWeight()
  const list = entries.data ?? []
  const latest = list.at(-1)
  const change = changeSince(list, 28, today)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(80)

  const openSheet = () => {
    setValue(latest?.weight_kg ?? 80)
    setOpen(true)
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">Körpergewicht</h2>
            <p className="font-display text-3xl tabular-nums" data-testid="body-weight-current">
              {latest ? `${formatWeight(latest.weight_kg)} kg` : '–'}
            </p>
            {change != null && (
              <p className="text-xs text-muted-foreground">{formatChange(change)} in 4 Wochen</p>
            )}
          </div>
          <Button className="min-h-[44px]" onClick={openSheet}>
            Gewicht eintragen
          </Button>
        </div>
        {entries.isPending && <Spinner />}
        {list.length >= 2 && (
          <Suspense fallback={<Spinner label="Diagramm lädt …" />}>
            <BodyWeightChart entries={list} />
          </Suspense>
        )}
        {entries.data && list.length < 2 && (
          <p className="rounded-md border p-4 text-center text-sm text-muted-foreground">
            Trage dein Gewicht an mehreren Tagen ein, dann erscheint der Verlauf.
          </p>
        )}
      </CardContent>
      <Sheet open={open} onOpenChange={setOpen} title="Körpergewicht eintragen">
        <div className="space-y-4 pb-2">
          <Stepper
            label="Gewicht (kg)"
            value={value}
            onChange={setValue}
            step={0.1}
            format={formatWeight}
            decimal
          />
          <p className="text-xs text-muted-foreground">
            Gilt für heute; ein zweiter Eintrag am selben Tag überschreibt den ersten.
          </p>
          <Button
            className="min-h-[44px] w-full"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { data: { weight_kg: value } },
                {
                  onSuccess: async () => {
                    setOpen(false)
                    toast.success('Gewicht gespeichert')
                    // Auch die Statistiken ändern sich (Körpergewichtsübungen, relative Stärke)
                    await queryClient.invalidateQueries()
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Speichern
          </Button>
        </div>
      </Sheet>
    </Card>
  )
}
