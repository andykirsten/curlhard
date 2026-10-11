import { Link } from '@tanstack/react-router'
import { useListSessions } from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Card, CardContent } from '@/components/ui/card'
import { durationLabel, formatDate } from '@/lib/dates'

export function HistoryPage() {
  const { data, isLoading } = useListSessions({ limit: 100 })
  return (
    <>
      <PageHeader title="Verlauf" profile />
      <div className="space-y-3 p-4">
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
                      <div className="font-medium">{formatDate(s.started_at)}</div>
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
