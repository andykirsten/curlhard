import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useExerciseInsights, useExerciseSummary, useGetExercise, useListMuscleGroups } from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { ExerciseHero } from '@/components/exercise/ExerciseHero'
import { HistoryTab } from '@/components/exercise/HistoryTab'
import { StatsTab } from '@/components/exercise/StatsTab'
import { Segmented } from '@/components/ui/segmented'

const TABS = [
  { value: 'statistik', label: 'Statistik' },
  { value: 'historie', label: 'Historie' },
]

export function ExerciseDetailPage() {
  const { exerciseId } = useParams({ strict: false }) as { exerciseId: string }
  const id = Number(exerciseId)
  const { tab } = useSearch({ strict: false }) as { tab?: 'statistik' | 'historie' }
  const active = tab ?? 'statistik'
  const navigate = useNavigate()

  const exercise = useGetExercise(id)
  const muscles = useListMuscleGroups()
  const summary = useExerciseSummary(id)
  const insights = useExerciseInsights(id)

  if (exercise.isLoading) return <Spinner />
  if (!exercise.data) return <EmptyState title="Übung nicht gefunden" />
  const muscleName = muscles.data?.find((m) => m.id === exercise.data.primary_muscle_group_id)?.name

  return (
    <>
      <PageHeader title={exercise.data.name} back="/exercises" backHistory />
      <div className="space-y-5 p-4 md:p-6">
        <ExerciseHero
          exercise={exercise.data}
          muscleName={muscleName}
          summary={summary.data}
          insights={insights.data}
        />
        <Segmented
          aria-label="Ansicht"
          value={active}
          options={TABS}
          onChange={(value) =>
            void navigate({
              to: '/exercises/$exerciseId',
              params: { exerciseId },
              search: value === 'historie' ? { tab: 'historie' } : {},
              replace: true,
            })
          }
        />
        {active === 'historie' ? (
          <HistoryTab exerciseId={id} loadType={exercise.data.load_type} />
        ) : (
          <StatsTab exerciseId={id} loadType={exercise.data.load_type} insights={insights.data} />
        )}
      </div>
    </>
  )
}
