import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HistoryPoint } from '@/api'
import { formatShortDate } from '@/lib/dates'

export default function ExerciseCharts({ points }: { points: HistoryPoint[] }) {
  const data = points.map((p) => ({
    label: formatShortDate(p.date),
    e1rm: p.e1rm,
    volume: p.volume,
  }))
  return (
    <div className="h-64 w-full" role="img" aria-label="Verlauf von e1RM und Volumen">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="rm" tick={{ fontSize: 11 }} unit=" kg" domain={['auto', 'auto']} />
          <YAxis yAxisId="vol" orientation="right" hide />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
            }}
          />
          <Legend />
          <Bar
            yAxisId="vol"
            dataKey="volume"
            name="Volumen (kg)"
            fill="hsl(var(--muted-foreground))"
            opacity={0.35}
            isAnimationActive={false}
          />
          <Line
            yAxisId="rm"
            type="monotone"
            dataKey="e1rm"
            name="e1RM (kg)"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
