import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BodyWeightRead } from '@/api'
import { AXIS_TICK, COLORS } from '@/components/exercise/charts/theme'
import { ChartTooltip } from '@/components/exercise/charts/shared'
import { formatShortDate } from '@/lib/dates'
import { usePrefersReducedMotion } from '@/lib/useMediaQuery'

/** Verlauf des Körpergewichts als Linie (ein Punkt je Eintrag). */
export default function BodyWeightChart({ entries }: { entries: BodyWeightRead[] }) {
  const reduced = usePrefersReducedMotion()
  const data = useMemo(
    () => entries.map((e) => ({ label: formatShortDate(e.measured_on), kg: e.weight_kg })),
    [entries],
  )
  return (
    <div className="h-48 w-full md:h-56" role="img" aria-label="Verlauf des Körpergewichts">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 1', 'dataMax + 1']}
            tickFormatter={(v: number) => String(Math.round(v))}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: COLORS.muted, strokeDasharray: '3 3' }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                payload={payload?.map((p) => ({ ...p, unit: 'kg' }))}
                title={String(label ?? '')}
              />
            )}
          />
          <Line
            type="monotone"
            dataKey="kg"
            name="Gewicht"
            stroke={COLORS.primary}
            strokeWidth={3}
            dot={{ r: 2.5, fill: COLORS.primary }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            isAnimationActive={!reduced}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
