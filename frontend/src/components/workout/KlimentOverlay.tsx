import { useEffect, useState } from 'react'
import { nextDelayMs, pickPhrase, speak } from '@/lib/kliment'

const VISIBLE_MS = 3000
const SLIDE_MS = 300

function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Freundlicher Cartoon-Kopf: gebräunte Haut, kurze dunkle Haare, volle Lippen, Dreitagebart. */
function KlimentHead() {
  const stubble: [number, number][] = [
    [32, 62],
    [37, 66],
    [42, 69],
    [48, 71],
    [54, 69],
    [59, 66],
    [64, 62],
    [30, 55],
    [66, 55],
    [35, 59],
    [61, 59],
    [40, 63],
    [56, 63],
    [45, 66],
    [51, 66],
    [33, 67],
    [63, 67],
    [38, 71],
    [58, 71],
    [44, 74],
    [52, 74],
  ]
  return (
    <svg viewBox="0 0 96 96" width="84" height="84" aria-hidden="true" focusable="false">
      <path d="M22 96c2-14 12-20 26-20s24 6 26 20z" fill="#3b4a5c" />
      <rect x="40" y="66" width="16" height="14" rx="6" fill="#a8734b" />
      <ellipse cx="22" cy="46" rx="4.5" ry="7" fill="#b9825a" />
      <ellipse cx="74" cy="46" rx="4.5" ry="7" fill="#b9825a" />
      <path d="M24 44c0-20 10-30 24-30s24 10 24 30c0 18-8 32-24 32S24 62 24 44z" fill="#c18b61" />
      <path
        d="M23 44c-2-22 9-33 25-33s27 11 25 33c-2-8-5-14-9-17-9 4-27 4-33 0-4 3-6 9-8 17z"
        fill="#1f1612"
      />
      <path
        d="M33 38q5-3 10 0M53 38q5-3 10 0"
        stroke="#1f1612"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="38" cy="44" r="2.6" fill="#1f1612" />
      <circle cx="58" cy="44" r="2.6" fill="#1f1612" />
      <path
        d="M48 46c-2 5-3 7 0 8"
        stroke="#8f5c3a"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <g fill="#1f1612" opacity="0.45">
        {stubble.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.7" />
        ))}
      </g>
      <path d="M36 62q12-4 24 0q-3 4-12 4t-12-4z" fill="#a14b4b" />
      <path d="M36 62q12 4 24 0q-2 9-12 9t-12-9z" fill="#b95b5b" />
      <path d="M38 62q10 2 20 0" stroke="#6e2c2c" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

/**
 * Kliment-Modus: der Kopf erscheint in zufälligen Abständen am rechten Rand,
 * ruft eine Phrase und verschwindet nach ca. 3 s wieder. Tippen schließt ihn sofort.
 */
export function KlimentOverlay({ rng = Math.random }: { rng?: () => number }) {
  const [phrase, setPhrase] = useState<string | null>(null)
  const [entered, setEntered] = useState(false)
  const [dismissKey, setDismissKey] = useState(0)

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id)
        fn()
      }, ms)
      timers.add(id)
    }
    const reduced = prefersReducedMotion()

    const schedule = () => later(fire, nextDelayMs(rng))
    const hide = () => {
      setEntered(false)
      later(
        () => {
          setPhrase(null)
          schedule()
        },
        reduced ? 0 : SLIDE_MS,
      )
    }
    function fire() {
      if (document.hidden) {
        schedule()
        return
      }
      const p = pickPhrase(rng)
      setPhrase(p)
      // erst nach dem ersten Render einblenden, damit die Slide-Transition greift
      later(() => setEntered(true), reduced ? 0 : 30)
      speak(p)
      later(hide, VISIBLE_MS)
    }

    schedule()
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
        } catch {
          /* ignorieren */
        }
      }
    }
    // dismissKey startet den Ablauf nach einem Tipp neu
  }, [rng, dismissKey])

  if (phrase === null) return null

  const reduced = prefersReducedMotion()
  return (
    <div
      className="pointer-events-none fixed bottom-60 right-0 z-30 flex items-end"
      data-testid="kliment-overlay"
    >
      <div
        className={`flex items-end ${
          reduced ? '' : 'transition-transform duration-300 ease-out'
        } ${entered || reduced ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div
          role="status"
          className="mb-10 mr-[-6px] rounded-2xl rounded-br-sm border bg-card px-3 py-1.5 text-sm font-bold text-card-foreground shadow-md"
        >
          {phrase}
        </div>
        <button
          type="button"
          aria-label="Kliment ausblenden"
          className="pointer-events-auto touch-manipulation"
          onClick={() => {
            try {
              window.speechSynthesis?.cancel()
            } catch {
              /* ignorieren */
            }
            setPhrase(null)
            setEntered(false)
            setDismissKey((k) => k + 1)
          }}
        >
          <KlimentHead />
        </button>
      </div>
    </div>
  )
}
