import { usePrFeed } from '@/api'
import { PrTimeline } from '@/components/exercise/PrTimeline'
import { PageHeader } from '@/components/Layout'
import { BalanceCard } from '@/components/stats/BalanceCard'
import { BodyWeightCard } from '@/components/stats/BodyWeightCard'

/** Statistik über alle Übungen: Muskelgruppen-Balance, Rekorde und Körpergewicht. */
export function StatsPage() {
  const prs = usePrFeed({ limit: 15 })
  return (
    <>
      <PageHeader title="Statistik" profile />
      <div className="space-y-4 p-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <BalanceCard />
        <div className="space-y-4">
          <PrTimeline events={prs.data?.items ?? []} newestFirst />
          <BodyWeightCard />
        </div>
      </div>
    </>
  )
}
