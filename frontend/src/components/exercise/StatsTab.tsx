import { subMonths, subWeeks, subYears } from 'date-fns'
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import {
  useExerciseHistory,
  useExerciseInsights,
  useGetNote,
  usePutNote,
  type InsightsRead,
} from '@/api'
import { Spinner } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { FrequencyHeatmap } from './FrequencyHeatmap'
import { LifetimeTiles } from './LifetimeTiles'
import { NextTargetCard } from './NextTargetCard'
import { PrTimeline } from './PrTimeline'

// recharts steckt in eigenen Chunks und wird erst auf der Statistik-Seite geladen
const E1rmChart = lazy(() => import('./charts/E1rmChart'))
const RepProfileChart = lazy(() => import('./charts/RepProfileChart'))
const WeeklyVolumeChart = lazy(() => import('./charts/WeeklyVolumeChart'))
const RepRangeDonut = lazy(() => import('./charts/RepRangeDonut'))

const RANGES = [
  { key: '4w', label: '4 Wochen', from: () => subWeeks(new Date(), 4) },
  { key: '3m', label: '3 Monate', from: () => subMonths(new Date(), 3) },
  { key: '1y', label: '1 Jahr', from: () => subYears(new Date(), 1) },
  { key: 'all', label: 'Alles', from: () => null },
] as const

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="text-lg">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Suspense fallback={<Spinner label="Diagramm lädt …" />}>{children}</Suspense>
      </CardContent>
    </Card>
  )
}

function NoData() {
  return (
    <p className="rounded-md border p-4 text-center text-sm text-muted-foreground">
      Noch keine Daten in diesem Zeitraum.
    </p>
  )
}

export function StatsTab({
  exerciseId,
  loadType,
  insights,
}: {
  exerciseId: number
  loadType: string
  insights: InsightsRead | undefined
}) {
  const isTime = loadType === 'time'
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['key']>('3m')
  const from = useMemo(() => {
    const r = RANGES.find((x) => x.key === rangeKey)!.from()
    return r ? r.toISOString() : undefined
  }, [rangeKey])
  const history = useExerciseHistory(exerciseId, { from, metric: 'e1rm' })
  const ranged = useExerciseInsights(exerciseId, { from })
  const note = useGetNote(exerciseId)
  const putNote = usePutNote()
  const [draft, setDraft] = useState<string | null>(null)

  const points = history.data?.points ?? []
  const rangedData = ranged.data
  const hasAny = (insights?.lifetime.total_sessions ?? 0) > 0

  return (
    <div className="space-y-4">
      {!hasAny && insights && (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Sobald du diese Übung trainierst, erscheinen hier Verlauf, Rekorde und Auswertungen.
        </p>
      )}

      {hasAny && (
        <>
          <div className="flex gap-1" role="group" aria-label="Zeitraum">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={rangeKey === r.key ? 'default' : 'secondary'}
                aria-pressed={rangeKey === r.key}
                onClick={() => setRangeKey(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ChartCard
                title={isTime ? 'Dauer pro Session' : 'e1RM-Verlauf'}
                hint={isTime ? undefined : 'Gold = neuer Rekord, gestrichelt = Allzeit-Hoch'}
              >
                {points.length > 0 ? (
                  <E1rmChart points={points} prEvents={insights?.pr_events ?? []} time={isTime} />
                ) : (
                  <NoData />
                )}
              </ChartCard>
            </div>

            {!isTime && insights && insights.rep_profile.length > 0 && (
              <ChartCard
                title="Rep-Max-Profil"
                hint="Gold = Bestwert liegt unter der Schätzung – hier ist ein PR leicht drin"
              >
                <RepProfileChart profile={insights.rep_profile} />
              </ChartCard>
            )}
            {!isTime && insights && insights.rep_profile.length > 0 && (
              <NextTargetCard profile={insights.rep_profile} />
            )}

            {!isTime && (
              <ChartCard title="Wochenvolumen" hint="Balken: Tonnage · Linie: Arbeitssätze">
                {rangedData && rangedData.weekly.length > 0 ? (
                  <WeeklyVolumeChart weekly={rangedData.weekly} />
                ) : (
                  <NoData />
                )}
              </ChartCard>
            )}
            {!isTime && (
              <ChartCard title="Intensitätsverteilung" hint="Arbeitssätze nach Wiederholungsbereich">
                {rangedData && rangedData.lifetime.total_working_sets > 0 ? (
                  <RepRangeDonut ranges={rangedData.rep_ranges} />
                ) : (
                  <NoData />
                )}
              </ChartCard>
            )}

            {insights && (
              <div className="md:col-span-2">
                <FrequencyHeatmap exerciseId={exerciseId} trainingDays={insights.training_days} />
              </div>
            )}
          </div>

          {insights && <LifetimeTiles lifetime={insights.lifetime} loadType={loadType} />}
          {insights && <PrTimeline events={insights.pr_events} loadType={loadType} />}
        </>
      )}

      <section aria-label="Memo" className="space-y-2">
        <h2 className="text-lg">Dauerhaftes Memo</h2>
        <Textarea
          aria-label="Dauerhaftes Memo"
          placeholder="z. B. Sitzeinstellung, Griffbreite …"
          value={draft ?? note.data?.note ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft != null && draft !== (note.data?.note ?? '')) {
              putNote.mutate(
                { exerciseId, data: { note: draft } },
                {
                  onSuccess: () => {
                    setDraft(null)
                    void note.refetch()
                  },
                },
              )
            }
          }}
        />
      </section>
    </div>
  )
}
