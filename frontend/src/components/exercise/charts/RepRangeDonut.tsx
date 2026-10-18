import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { RepRanges } from '@/api'
import { usePrefersReducedMotion } from '@/lib/useMediaQuery'
import { ChartTooltip } from './shared'
import { COLORS } from './theme'

const SLICES = [
  { key: 'strength', label: 'Kraft (1–5 Wdh.)', color: COLORS.primary },
  { key: 'hypertrophy', label: 'Hypertrophie (6–12)', color: COLORS.gold },
  { key: 'endurance', label: 'Ausdauer (13+)', color: COLORS.muted },
] as const

/** Intensitätsverteilung: Arbeitssätze nach Wiederholungsbereich als Donut mit Legende. */
export default function RepRangeDonut({ ranges }: { ranges: RepRanges }) {
  const reduced = usePrefersReducedMotion()
  const total = ranges.strength + ranges.hypertrophy + ranges.endurance
  const data = SLICES.map((s) => ({ ...s, value: ranges[s.key] }))
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div
        className="relative h-44 w-44 shrink-0"
        role="img"
        aria-label={`Verteilung von ${total} Arbeitssätzen nach Wiederholungsbereich`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  payload={payload?.map((p) => ({
                    name: String(p.name ?? ''),
                    value: p.value,
                    color: (p.payload as { color?: string } | undefined)?.color,
                    unit: 'Sätze',
                  }))}
                />
              )}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={total > 0 ? 2 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={!reduced}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl leading-none tabular-nums">{total}</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Sätze
          </span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: d.color }} />
            <span>{d.label}</span>
            <span className="ml-auto font-bold tabular-nums">
              {total > 0 ? Math.round((d.value / total) * 100) : 0} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
