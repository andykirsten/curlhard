import { useState } from 'react'
import { useBalance } from '@/api'
import { Spinner } from '@/components/Layout'
import { Card, CardContent } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import {
  balanceStatus,
  barPercent,
  formatSets,
  scaleMax,
  STATUS_LABEL,
  TARGET_MAX,
  TARGET_MIN,
} from '@/lib/balance'
import { cn } from '@/lib/utils'

const RANGES = [
  { value: '4', label: '4 Wochen' },
  { value: '8', label: '8 Wochen' },
  { value: '12', label: '12 Wochen' },
]

/**
 * Muskelgruppen-Balance: Arbeitssätze pro Woche je Muskelgruppe als Balkenliste mit
 * Zielbereich 10–20. Reines CSS statt Chart-Bibliothek: Wert und Status stehen als Text da,
 * die Farbe allein trägt keine Information.
 */
export function BalanceCard() {
  const [weeks, setWeeks] = useState('4')
  const balance = useBalance({ weeks: Number(weeks) })
  const rows = balance.data?.muscle_groups ?? []
  const max = scaleMax(rows.map((r) => r.sets_per_week))
  const trained = rows.some((r) => r.sets_per_week > 0)

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="text-lg">Muskelgruppen-Balance</h2>
          <p className="text-xs text-muted-foreground">
            Arbeitssätze pro Woche, Nebenmuskeln zählen halb. Zielbereich {TARGET_MIN}–{TARGET_MAX}.
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
              const status = balanceStatus(r.sets_per_week)
              return (
                <li
                  key={r.muscle_group_id}
                  aria-label={`${r.name}: ${formatSets(r.sets_per_week)} Sätze pro Woche, ${STATUS_LABEL[status]}`}
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold">{r.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-display text-base">{formatSets(r.sets_per_week)}</span>{' '}
                      <span className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</span>
                    </span>
                  </div>
                  <div aria-hidden className="relative mt-1 h-2.5 rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        status === 'low' ? 'bg-muted-foreground/40' : 'bg-primary',
                      )}
                      style={{ width: `${barPercent(r.sets_per_week, max)}%` }}
                    />
                    {[TARGET_MIN, TARGET_MAX].map((t) => (
                      <span
                        key={t}
                        className="absolute inset-y-[-3px] w-px bg-foreground/50"
                        style={{ left: `${barPercent(t, max)}%` }}
                      />
                    ))}
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
