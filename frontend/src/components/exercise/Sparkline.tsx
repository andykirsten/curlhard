import { useId } from 'react'
import { sparklinePath } from '@/lib/exerciseStats'

/** Kleine Verlaufslinie mit Verlaufsfläche und Endpunkt (reine SVG, keine Bibliothek). */
export function Sparkline({
  values,
  width = 120,
  height = 40,
  className,
  label,
}: {
  values: readonly (number | null)[]
  width?: number
  height?: number
  className?: string
  label: string
}) {
  const gid = useId()
  const { line, area, last } = sparklinePath(values, width, height)
  if (!line) return null
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))' }} stopOpacity={0.4} />
          <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))' }} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill="hsl(var(--gold))" />}
    </svg>
  )
}
