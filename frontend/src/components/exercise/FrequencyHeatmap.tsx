import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { buildHeatmap, formatDay } from '@/lib/exerciseStats'

/** Trainingsfrequenz der letzten 26 Wochen im GitHub-Stil (CSS-Grid, ohne Chart-Bibliothek). */
export function FrequencyHeatmap({
  exerciseId,
  trainingDays,
}: {
  exerciseId: number
  trainingDays: string[]
}) {
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const { columns, trainedWeeks } = useMemo(() => buildHeatmap(trainingDays, now), [trainingDays, now])
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg">Trainingsfrequenz</h2>
          <p className="text-xs text-muted-foreground">
            {trainedWeeks} von {columns.length} Wochen trainiert
          </p>
        </div>
        <div
          role="group"
          aria-label="Trainingstage der letzten 26 Wochen"
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            gridTemplateRows: 'repeat(7, auto)',
            gridAutoFlow: 'column',
          }}
        >
          {columns.flat().map((cell, i) =>
            cell.key == null ? (
              <span key={`e${i}`} aria-hidden className="aspect-square" />
            ) : cell.level === 0 ? (
              <span
                key={cell.key}
                aria-hidden
                className="aspect-square rounded-[3px] bg-secondary"
              />
            ) : (
              <button
                key={cell.key}
                type="button"
                title={formatDay(cell.key, 'EEE, d. MMM yyyy')}
                aria-label={`Training am ${formatDay(cell.key, 'd. MMMM yyyy')}, zur Historie`}
                onClick={() =>
                  void navigate({
                    to: '/exercises/$exerciseId',
                    params: { exerciseId: String(exerciseId) },
                    search: { tab: 'historie' },
                    replace: true,
                  })
                }
                className="aspect-square rounded-[3px] bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.55)]"
              />
            ),
          )}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          <span>Kein Training</span>
          <span aria-hidden className="h-3 w-3 rounded-[3px] bg-secondary" />
          <span aria-hidden className="h-3 w-3 rounded-[3px] bg-primary" />
          <span>Training</span>
        </div>
      </CardContent>
    </Card>
  )
}
