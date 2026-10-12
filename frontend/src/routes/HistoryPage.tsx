import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useListCycles, useListSessions } from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/input'
import { durationLabel, formatDate, formatShortDate } from '@/lib/dates'

export function HistoryPage() {
  const [cycleFilter, setCycleFilter] = useState('')
  const cycles = useListCycles()
  const { data, isLoading } = useListSessions({
    limit: 100,
    // undefined statt null: orval serialisiert null als "null" in die Query
    cycle_id: cycleFilter ? Number(cycleFilter) : undefined,
  })
  const selectedCycle = cycles.data?.find((c) => String(c.id) === cycleFilter)
  return (
    <>
      <PageHeader title="Verlauf" profile />
      <div className="space-y-3 p-4">
        {(cycles.data?.length ?? 0) > 0 && (
          <div className="space-y-1">
            <Label htmlFor="cycle-filter">Zyklus</Label>
            <Select
              id="cycle-filter"
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {cycles.data?.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {selectedCycle && data && (
          <p className="text-sm text-muted-foreground">
            {selectedCycle.session_count}{' '}
            {selectedCycle.session_count === 1 ? 'Training' : 'Trainings'} · {selectedCycle.name} ·{' '}
            {formatShortDate(selectedCycle.start_date)} –{' '}
            {selectedCycle.end_date ? formatShortDate(selectedCycle.end_date) : 'laufend'}
          </p>
        )}
        {isLoading && <Spinner />}
        {data?.length === 0 && (
          <EmptyState
            title="Noch keine Trainings"
            hint="Sobald du dein erstes Workout beendest, erscheint es hier."
          />
        )}
        <ul className="space-y-2">
          {data?.map((s) => (
            <li key={s.id}>
              <Link to="/workout/$sessionId" params={{ sessionId: String(s.id) }}>
                <Card>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {formatDate(s.started_at)}
                        {s.cycle_name && <Badge variant="secondary">{s.cycle_name}</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {s.exercise_count} Übungen · {s.set_count} Sätze
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {durationLabel(s.started_at, s.finished_at)}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
