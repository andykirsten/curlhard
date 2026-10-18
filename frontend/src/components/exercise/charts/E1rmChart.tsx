import { useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HistoryPoint, PrEvent } from '@/api'
import { formatShortDate } from '@/lib/dates'
import { usePrefersReducedMotion } from '@/lib/useMediaQuery'
import { ChartTooltip, PrDot } from './shared'
import { AXIS_TICK, COLORS } from './theme'

/**
 * Verlauf: e1RM als Fläche mit gestufter Allzeit-Hoch-Linie, PR-Sessions in Gold.
 * Bei Zeitübungen (`time`) wird die Dauer pro Session gezeigt.
 */
export default function E1rmChart({
  points,
  prEvents,
  time,
}: {
  points: HistoryPoint[]
  prEvents: PrEvent[]
  time: boolean
}) {
  const reduced = usePrefersReducedMotion()
  const [showRpe, setShowRpe] = useState(false)
  const prSessions = useMemo(
    () => new Set(prEvents.filter((e) => e.kind === 'e1rm').map((e) => e.session_id)),
    [prEvents],
  )
  const data = useMemo(() => {
    const values = points.map((p) => (time ? p.duration_sec : p.e1rm))
    return points.map((p, i) => {
      const high = Math.max(0, ...values.slice(0, i + 1).map((v) => v ?? 0))
      return {
        label: formatShortDate(p.date),
        value: values[i],
        high: high || null,
        rpe: p.avg_rpe,
        pr: !time && prSessions.has(p.session_id),
      }
    })
  }, [points, prSessions, time])
  const hasRpe = !time && data.some((d) => d.rpe != null)
  const unit = time ? 's' : 'kg'
  const name = time ? 'Dauer' : 'e1RM'

  return (
    <div>
      <div
        className="h-64 w-full md:h-72"
        role="img"
        aria-label={time ? 'Verlauf der Dauer pro Session' : 'Verlauf des geschätzten Maximums (e1RM)'}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: hasRpe && showRpe ? 4 : 12, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="e1rm-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: COLORS.primary }} stopOpacity={0.45} />
                <stop offset="100%" style={{ stopColor: COLORS.primary }} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              yAxisId="main"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              width={44}
            />
            {hasRpe && showRpe && (
              <YAxis yAxisId="rpe" orientation="right" domain={[5, 10]} hide />
            )}
            <Tooltip
              cursor={{ stroke: COLORS.muted, strokeDasharray: '3 3' }}
              content={({ active, payload, label }) => (
                <ChartTooltip
                  active={active}
                  payload={payload?.map((p) => ({ ...p, unit: p.dataKey === 'rpe' ? '' : unit }))}
                  title={String(label ?? '')}
                />
              )}
            />
            <Area
              yAxisId="main"
              type="monotone"
              dataKey="value"
              name={name}
              stroke={COLORS.primary}
              strokeWidth={3}
              fill="url(#e1rm-fill)"
              connectNulls
              dot={(p: { cx?: number; cy?: number; payload?: { pr?: boolean }; index?: number }) =>
                p.payload?.pr ? (
                  <PrDot key={`pr-${p.index}`} cx={p.cx} cy={p.cy} />
                ) : (
                  <circle
                    key={`d-${p.index}`}
                    cx={p.cx}
                    cy={p.cy}
                    r={2.5}
                    fill={COLORS.primary}
                  />
                )
              }
              activeDot={{ r: 5, strokeWidth: 0 }}
              isAnimationActive={!reduced}
            />
            {!time && (
              <Line
                yAxisId="main"
                type="stepAfter"
                dataKey="high"
                name="Allzeit-Hoch"
                stroke={COLORS.gold}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                isAnimationActive={!reduced}
              />
            )}
            {hasRpe && showRpe && (
              <Line
                yAxisId="rpe"
                type="monotone"
                dataKey="rpe"
                name="Ø RPE"
                stroke={COLORS.muted}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={!reduced}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {hasRpe && (
        <button
          type="button"
          aria-pressed={showRpe}
          onClick={() => setShowRpe((v) => !v)}
          className="mt-1 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground aria-pressed:border-primary aria-pressed:text-primary"
        >
          RPE-Trend {showRpe ? 'ausblenden' : 'einblenden'}
        </button>
      )}
    </div>
  )
}
