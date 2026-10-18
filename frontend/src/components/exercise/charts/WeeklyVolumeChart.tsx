import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeeklyPoint } from '@/api'
import { formatShortDate } from '@/lib/dates'
import { usePrefersReducedMotion } from '@/lib/useMediaQuery'
import { ChartTooltip } from './shared'
import { AXIS_TICK, COLORS } from './theme'

/** Wochenvolumen (Balken, Tonnage) und harte Sätze pro Woche (Linie). */
export default function WeeklyVolumeChart({ weekly }: { weekly: WeeklyPoint[] }) {
  const reduced = usePrefersReducedMotion()
  const data = weekly.map((w) => ({
    label: formatShortDate(w.week_start),
    volume: w.volume,
    sets: w.working_sets,
  }))
  return (
    <div className="h-64 w-full md:h-72" role="img" aria-label="Wochenvolumen und Arbeitssätze pro Woche">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 0, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="vol-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: COLORS.primary }} stopOpacity={0.9} />
              <stop offset="100%" style={{ stopColor: COLORS.primary }} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            yAxisId="vol"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
          />
          <YAxis
            yAxisId="sets"
            orientation="right"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--accent))', opacity: 0.5 }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                payload={payload?.map((p) => ({
                  ...p,
                  unit: p.dataKey === 'volume' ? 'kg' : 'Sätze',
                }))}
                title={`Woche ab ${String(label ?? '')}`}
              />
            )}
          />
          <Bar
            yAxisId="vol"
            dataKey="volume"
            name="Volumen"
            fill="url(#vol-bar)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reduced}
          />
          <Line
            yAxisId="sets"
            type="monotone"
            dataKey="sets"
            name="Arbeitssätze"
            stroke={COLORS.gold}
            strokeWidth={2.5}
            dot={{ r: 3, fill: COLORS.gold, strokeWidth: 0 }}
            isAnimationActive={!reduced}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
