import { TrendingDown } from 'lucide-react'
import { useState } from 'react'
import { useDeload } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { isDeloadDismissed, joinNames } from '@/lib/deload'
import { useSettings } from '@/stores/settings'

/** Hinweis „Deload-Woche erwägen“; sieben Tage ausblendbar, ohne Treffer unsichtbar. */
export function DeloadCard({ className }: { className?: string }) {
  const dismissedAt = useSettings((s) => s.deloadDismissedAt)
  const set = useSettings((s) => s.set)
  const [now] = useState(() => Date.now())
  const dismissed = isDeloadDismissed(dismissedAt, now)
  const deload = useDeload({ query: { enabled: !dismissed } })
  if (dismissed || !deload.data?.recommended) return null
  return (
    <Card className={className} data-testid="deload-card">
      <CardContent className="flex items-start gap-3">
        <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Deload-Woche erwägen</p>
          <p className="text-sm text-muted-foreground">
            {joinNames(deload.data.exercises.map((e) => e.name))}: Die Leistung sinkt oder die
            Anstrengung steigt seit drei Sessions.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] shrink-0"
          onClick={() => set({ deloadDismissedAt: Date.now() })}
        >
          Ausblenden
        </Button>
      </CardContent>
    </Card>
  )
}
