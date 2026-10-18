import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RepProfilePoint } from '@/api'
import { usePrefersReducedMotion } from '@/lib/useMediaQuery'
import { ChartTooltip } from './shared'
import { AXIS_TICK, COLORS } from './theme'

/**
 * Rep-Max-Profil: Balken = echter Bestwert (Last bei mindestens n Wdh.), Linie = Schätzkurve
 * aus dem besten e1RM. Lücken zwischen Balken und Kurve (>= 3 %) sind golden hervorgehoben:
 * dort ist ein PR „leicht drin“.
 */
export default function RepProfileChart({ profile }: { profile: RepProfilePoint[] }) {
  const reduced = usePrefersReducedMotion()
  const data = profile.map((p) => {
    const gap = p.actual_kg == null || p.actual_kg < p.estimated_kg * 0.97
    return { reps: String(p.reps), actual: p.actual_kg, estimated: p.estimated_kg, gap }
  })
  return (
    <div
      className="h-64 w-full md:h-72"
      role="img"
      aria-label="Bestwerte je Wiederholungszahl im Vergleich zur Schätzung"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="rep-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: COLORS.primary }} stopOpacity={1} />
              <stop offset="100%" style={{ stopColor: COLORS.primary }} stopOpacity={0.45} />
            </linearGradient>
            <linearGradient id="rep-gap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: COLORS.gold }} stopOpacity={1} />
              <stop offset="100%" style={{ stopColor: COLORS.gold }} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={COLORS.grid} vertical={false} />
          <XAxis
            dataKey="reps"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Wiederholungen', position: 'insideBottom', offset: -2, fontSize: 10, fill: COLORS.muted }}
            height={30}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} domain={[0, 'auto']} width={44} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--accent))', opacity: 0.5 }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                payload={payload?.map((p) => ({ ...p, unit: 'kg' }))}
                title={`${String(label ?? '')} Wdh.`}
              />
            )}
          />
          <Bar
            dataKey="actual"
            name="Bestwert"
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reduced}
          >
            {data.map((d) => (
              <Cell key={d.reps} fill={d.gap ? 'url(#rep-gap)' : 'url(#rep-bar)'} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="estimated"
            name="Schätzung"
            stroke={COLORS.muted}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={!reduced}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
