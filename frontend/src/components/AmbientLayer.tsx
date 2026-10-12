import { useEffect, useRef, useState } from 'react'
import {
  makeItem,
  PREWARM,
  PROFILES,
  type AmbientItem,
  type AmbientProfile,
  type Shape,
} from '@/lib/ambient'

/**
 * „Eisen im Hintergrund“ (Design „Ambient Hanteln“): Lang-, Kurzhanteln und Kettlebells
 * driften langsam und leicht rotierend hinter dem Inhalt durchs Bild, selten ein oranges Teil.
 * Jedes Teil startet außerhalb, durchquert den Screen einmal und wird danach entfernt.
 * Bewegt wird nur `transform` (Web Animations API, läuft auch auf iOS 15 ohne var() in Keyframes).
 */
function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function AmbientLayer({
  profile,
  fixed = false,
}: {
  profile: AmbientProfile
  /** Viewport-fest über der App-Spalte statt absolut im Screen-Container */
  fixed?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [reduced] = useState(prefersReducedMotion)
  // Beim Öffnen bis zu 3 Teile vorwärmen, damit der Screen nicht leer startet. Der Container
  // ist noch nicht gemessen; die Fenstergröße reicht, die Teile starten so nur weiter außen.
  const [items, setItems] = useState<AmbientItem[]>(() => {
    if (reduced) return []
    const p = PROFILES[profile]
    return Array.from({ length: Math.min(p.max, PREWARM) }, () =>
      makeItem(p, window.innerWidth, window.innerHeight, true),
    )
  })

  const size = () => {
    const el = ref.current
    return { w: el?.clientWidth || 390, h: el?.clientHeight || 844 }
  }

  // Nachschub; laufende Teile bleiben beim Profilwechsel erhalten
  useEffect(() => {
    if (reduced) return
    const p = PROFILES[profile]
    let t: number
    const schedule = () => {
      t = window.setTimeout(
        () => {
          if (!document.hidden) {
            const { w, h } = size()
            const item = makeItem(p, w, h, false)
            setItems((s) => (s.length < p.max ? [...s, item] : s))
          }
          schedule()
        },
        p.every * 1000 * (0.6 + Math.random() * 0.8),
      )
    }
    schedule()
    return () => window.clearTimeout(t)
  }, [profile, reduced])

  if (reduced) return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-testid="ambient-layer"
      data-profile={profile}
      className={`ch-amb pointer-events-none z-0 overflow-hidden ${fixed ? 'fixed inset-0 mx-auto max-w-xl' : 'absolute inset-0'}`}
    >
      {items.map((it) => (
        <Drifter
          key={it.id}
          item={it}
          onDone={() => setItems((s) => s.filter((x) => x.id !== it.id))}
        />
      ))}
    </div>
  )
}

function Drifter({ item, onDone }: { item: AmbientItem; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = `translate(${item.x0}px, ${item.y0}px) rotate(${item.r0}deg)`
    const to = `translate(${item.x1}px, ${item.y1}px) rotate(${item.r1}deg)`
    if (typeof el.animate !== 'function') {
      // Ohne Web Animations API (z. B. jsdom): nur Lebensdauer einhalten
      el.style.transform = from
      const t = window.setTimeout(
        () => onDoneRef.current(),
        Math.max(0, item.dur + item.delay) * 1000,
      )
      return () => window.clearTimeout(t)
    }
    const anim = el.animate([{ transform: from }, { transform: to }], {
      duration: item.dur * 1000,
      delay: item.delay * 1000,
      easing: 'linear',
      fill: 'both',
    })
    anim.onfinish = () => onDoneRef.current()
    return () => anim.cancel()
  }, [item])

  return (
    <div
      ref={ref}
      data-shape={item.shape}
      className="absolute left-0 top-0 will-change-transform"
      style={{
        color: item.accent ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
        opacity: item.opacity,
      }}
    >
      <div style={{ transform: `scale(${item.scale})` }}>
        <Silhouette shape={item.shape} />
      </div>
    </div>
  )
}

function Silhouette({ shape }: { shape: Shape }) {
  if (shape === 'barbell') {
    return (
      <svg width="72" height="22" viewBox="0 0 72 22" fill="currentColor">
        <rect x="0" y="10" width="72" height="2" rx="1" />
        <rect x="8" y="2" width="5" height="18" rx="1.5" />
        <rect x="14" y="5" width="3" height="12" rx="1" />
        <rect x="59" y="2" width="5" height="18" rx="1.5" />
        <rect x="55" y="5" width="3" height="12" rx="1" />
      </svg>
    )
  }
  if (shape === 'dumbbell') {
    return (
      <svg width="32" height="16" viewBox="0 0 32 16" fill="currentColor">
        <rect x="7" y="7" width="18" height="2.5" rx="1" />
        <rect x="1" y="2" width="7" height="12" rx="2" />
        <rect x="24" y="2" width="7" height="12" rx="2" />
      </svg>
    )
  }
  return (
    <svg width="24" height="26" viewBox="0 0 24 26">
      <circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="12" cy="16.5" r="9" fill="currentColor" />
    </svg>
  )
}
