import { useParams } from '@tanstack/react-router'
import { subMonths, subWeeks, subYears } from 'date-fns'
import { lazy, Suspense, useMemo, useState } from 'react'
import {
  useExerciseHistory,
  useExerciseRecords,
  useExerciseSummary,
  useGetExercise,
  useGetNote,
  usePutNote,
} from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { formatDate } from '@/lib/dates'
import { formatWeight } from '@/lib/weight'

const ExerciseCharts = lazy(() => import('@/components/ExerciseCharts'))

const RANGES = [
  { key: '4w', label: '4 Wochen', from: () => subWeeks(new Date(), 4) },
  { key: '3m', label: '3 Monate', from: () => subMonths(new Date(), 3) },
  { key: '1y', label: '1 Jahr', from: () => subYears(new Date(), 1) },
  { key: 'all', label: 'Alles', from: () => null },
] as const

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-0.5 p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

const kg = (v: number | null | undefined) => (v == null ? '–' : `${formatWeight(v)} kg`)
const pct = (v: number | null | undefined) =>
  v == null ? undefined : `${v > 0 ? '+' : ''}${String(v).replace('.', ',')} %`

export function ExerciseDetailPage() {
  const { exerciseId } = useParams({ strict: false }) as { exerciseId: string }
  const id = Number(exerciseId)
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['key']>('3m')
  const from = useMemo(() => {
    const r = RANGES.find((x) => x.key === rangeKey)!.from()
    return r ? r.toISOString() : undefined
  }, [rangeKey])

  const exercise = useGetExercise(id)
  const summary = useExerciseSummary(id)
  const history = useExerciseHistory(id, { from, metric: 'e1rm' })
  const records = useExerciseRecords(id)
  const note = useGetNote(id)
  const putNote = usePutNote()
  const [draft, setDraft] = useState<string | null>(null)

  if (exercise.isLoading) return <Spinner />
  if (!exercise.data) return <EmptyState title="Übung nicht gefunden" />
  const s = summary.data
  const isTime = exercise.data.load_type === 'time'

  return (
    <>
      <PageHeader title={exercise.data.name} back="/exercises" />
      <div className="space-y-5 p-4">
        {!isTime && (
          <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="e1RM"
              value={kg(s?.e1rm)}
              hint={pct(s?.change_4w_pct) && `${pct(s?.change_4w_pct)} ggü. vor 4 Wochen`}
            />
            <Stat label="5RM (geschätzt)" value={kg(s?.nrm['5'])} />
            <Stat label="8RM (geschätzt)" value={kg(s?.nrm['8'])} />
            <Stat
              label="13RM (geschätzt)"
              value={kg(s?.nrm['13'])}
              hint={pct(s?.change_12w_pct) && `${pct(s?.change_12w_pct)} ggü. vor 12 Wochen`}
            />
          </section>
        )}
        {s && (
          <p className="text-sm text-muted-foreground">
            {s.session_count} Sessions
            {s.last_session && (
              <>
                {' '}
                · zuletzt {formatDate(s.last_session.date)}
                {s.last_session.volume != null && (
                  <> · Volumen {formatWeight(s.last_session.volume)} kg</>
                )}
              </>
            )}
          </p>
        )}

        <section aria-label="Verlauf" className="space-y-3">
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
          {history.data && history.data.points.length > 0 ? (
            <Suspense fallback={<Spinner label="Diagramm lädt …" />}>
              <ExerciseCharts points={history.data.points} />
            </Suspense>
          ) : (
            <p className="rounded-md border p-4 text-center text-sm text-muted-foreground">
              Noch keine Daten in diesem Zeitraum.
            </p>
          )}
        </section>

        {!isTime && (
          <section aria-label="Bestwerte" className="space-y-2">
            <h2 className="text-lg font-semibold">Tatsächliche Bestwerte</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1">Mind. Wdh.</th>
                  <th>Gewicht</th>
                  <th>Datum</th>
                </tr>
              </thead>
              <tbody>
                {records.data?.records.map((r) => (
                  <tr key={r.reps} className="border-t">
                    <td className="py-2">{r.reps}RM</td>
                    <td className="tabular-nums">{kg(r.weight_kg)}</td>
                    <td>{r.date ? formatDate(r.date, 'd. MMM yyyy') : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section aria-label="Memo" className="space-y-2">
          <h2 className="text-lg font-semibold">Dauerhaftes Memo</h2>
          <Textarea
            aria-label="Dauerhaftes Memo"
            placeholder="z. B. Sitzeinstellung, Griffbreite …"
            value={draft ?? note.data?.note ?? ''}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft != null && draft !== (note.data?.note ?? '')) {
                putNote.mutate(
                  { exerciseId: id, data: { note: draft } },
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
    </>
  )
}
