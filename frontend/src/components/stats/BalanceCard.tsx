import { useState } from 'react'
import { useBalance } from '@/api'
import { Spinner } from '@/components/Layout'
import { Card, CardContent } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { balancePercent, formatSets, referenceSets } from '@/lib/balance'

const RANGES = [
  { value: '4', label: '4 Wochen' },
  { value: '8', label: '8 Wochen' },
  { value: '12', label: '12 Wochen' },
]

/**
 * Muskelgruppen-Balance: Arbeitssätze pro Woche je Muskelgruppe als Balkenliste. Der Sollwert
 * ist relativ – die am meisten trainierte Gruppe ist 100 %. Reines CSS statt Chart-Bibliothek:
 * der Prozentwert steht als Text da, die Länge des Balkens allein trägt keine Information.
 */
export function BalanceCard() {
  const [weeks, setWeeks] = useState('4')
  const balance = useBalance({ weeks: Number(weeks) })
  const rows = balance.data?.muscle_groups ?? []
  const reference = referenceSets(rows.map((r) => r.sets_per_week))
  const trained = reference > 0

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="text-lg">Muskelgruppen-Balance</h2>
          <p className="text-xs text-muted-foreground">
            Arbeitssätze pro Woche, Nebenmuskeln zählen halb. Die am meisten trainierte Gruppe ist
            100 %.
          </p>
        </div>
        <Segmented
          aria-label="Zeitraum"
          value={weeks}
          options={RANGES}
          onChange={setWeeks}
        />
        {balance.isPending && <Spinner />}
        {balance.data && !trained && (
          <p className="rounded-md border p-4 text-center text-sm text-muted-foreground">
            Noch keine Daten – trainiere ein paar Wochen.
          </p>
        )}
        {trained && (
          <ul className="space-y-2" data-testid="balance-list">
            {rows.map((r) => {
              const percent = balancePercent(r.sets_per_week, reference)
              return (
                <li
                  key={r.muscle_group_id}
                  aria-label={`${r.name}: ${percent} % (${formatSets(r.sets_per_week)} Sätze pro Woche)`}
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold">{r.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-display text-base">{percent} %</span>{' '}
                      <span className="text-xs text-muted-foreground">
                        {formatSets(r.sets_per_week)} Sätze/Woche
                      </span>
                    </span>
                  </div>
                  <div aria-hidden className="mt-1 h-2.5 rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
