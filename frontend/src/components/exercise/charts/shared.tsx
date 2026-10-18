import type { ReactNode } from 'react'
import { COLORS } from './theme'

interface TooltipEntry {
  name?: string | number
  value?: unknown
  color?: string
  unit?: string
}

/** Tooltip als kleine Card im App-Look. `render` formatiert die Einträge. */
export function ChartTooltip({
  active,
  payload,
  title,
  extra,
}: {
  active?: boolean
  payload?: readonly TooltipEntry[]
  title?: string
  extra?: ReactNode
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      {title && (
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </div>
      )}
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.name)} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: p.color ?? COLORS.primary }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-bold tabular-nums">
              {typeof p.value === 'number' ? String(Math.round(p.value * 10) / 10).replace('.', ',') : '–'}
              {p.unit ? ` ${p.unit}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {extra}
    </div>
  )
}

/** Gold-Punkt mit Schein für PR-Werte. */
export function PrDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={COLORS.gold} opacity={0.22} />
      <circle cx={cx} cy={cy} r={4.5} fill={COLORS.gold} stroke="hsl(var(--card))" strokeWidth={1.5} />
    </g>
  )
}
