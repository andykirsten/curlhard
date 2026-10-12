import { useEffect, useRef } from 'react'

/**
 * Emblem oben rechts auf dem Login: Kern (Ø 82) und Ring (Ø 250, 34 px Rand).
 * Eine Kopie des Rings startet bei scale(.33) deckungsgleich mit dem Kern und läuft als
 * Schockwelle nach außen, der Ring federt beim Aufprall, ein Echo läuft aus dem Bild.
 * Keyframes stehen in index.css (chCore/chWave/chEcho/chEchoOut/chRing).
 */
export type EmblemPhase = 'idle' | 'pending' | 'error' | 'success'

const PERIOD: Record<EmblemPhase, number> = { idle: 2.8, pending: 1.2, error: 2.8, success: 1.2 }

const RING = { right: -90, top: -70, width: 250, height: 250 } as const

function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function LoginEmblem({
  phase,
  pulse = 0,
  onDone,
}: {
  phase: EmblemPhase
  /** Erhöhen startet den Zyklus sofort neu (z. B. beim Tippen auf „Anmelden“). */
  pulse?: number
  /** Wird nach dem einmaligen Puls von „error“ und „success“ aufgerufen. */
  onDone?: () => void
}) {
  const period = PERIOD[phase]
  const once = phase === 'error' || phase === 'success'
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    if (!once) return
    const t = window.setTimeout(
      () => onDoneRef.current?.(),
      prefersReducedMotion() ? 0 : period * 1000,
    )
    return () => window.clearTimeout(t)
  }, [once, period, pulse])

  const anim = (name: string): React.CSSProperties => ({
    animationName: name,
    animationDuration: `${period}s`,
    animationIterationCount: once ? 1 : 'infinite',
  })
  const hit = phase === 'error' ? 'hsl(var(--muted-foreground))' : undefined

  return (
    <div
      key={`${phase}-${pulse}`}
      aria-hidden="true"
      data-testid="login-emblem"
      data-phase={phase}
      className="ch-emblem pointer-events-none absolute inset-0"
      style={hit ? ({ '--ch-hit': hit } as React.CSSProperties) : undefined}
    >
      <div
        className="ch-echo border-[6px] border-primary"
        style={{ ...RING, ...anim(phase === 'success' ? 'chEchoOut' : 'chEcho') }}
      />
      <div className="border-[34px] border-primary" style={{ ...RING, ...anim('chRing') }} />
      <div
        className="ch-wave border-[34px]"
        style={{ ...RING, borderColor: 'var(--ch-hit)', ...anim('chWave') }}
      />
      <div
        className="border-2 border-border"
        style={{ right: -6, top: 14, width: 82, height: 82, ...anim('chCore') }}
      />
    </div>
  )
}
