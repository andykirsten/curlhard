import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { beep } from '@/lib/sound'
import { formatClock, isFinished, remainingSeconds } from '@/lib/timer'
import { useActiveSession } from '@/stores/activeSession'

const FINISHED_VISIBLE_MS = 8000

/**
 * Pausen-Timer: rechnet mit gespeichertem Endzeitpunkt statt Zählern.
 * Nach Bildschirmsperre/Tab-Wechsel wird beim Zurückkehren neu berechnet.
 */
export function RestTimer({
  now = () => Date.now(),
  focus = false,
}: {
  now?: () => number
  /** Im Fokusmodus (Workout) ohne Tab-Leiste: Dock weiter unten */
  focus?: boolean
}) {
  const endsAt = useActiveSession((s) => s.restEndsAt)
  const total = useActiveSession((s) => s.restTotalSec)
  const clear = useActiveSession((s) => s.clearRest)
  const extend = useActiveSession((s) => s.extendRest)
  const [tick, setTick] = useState(now())
  const notified = useRef<number | null>(null)

  useEffect(() => {
    if (endsAt == null) return
    const update = () => setTick(now())
    update()
    const id = window.setInterval(update, 250)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('pageshow', update)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('pageshow', update)
    }
  }, [endsAt, now])

  const finished = endsAt != null && isFinished(endsAt, tick)

  useEffect(() => {
    if (finished && endsAt != null && notified.current !== endsAt) {
      notified.current = endsAt
      beep()
    }
  }, [finished, endsAt])

  // „Pause vorbei“ schließt sich nach kurzer Zeit selbst (auch bei einem alten, wiederhergestellten Timer)
  useEffect(() => {
    if (!finished) return
    const id = window.setTimeout(clear, FINISHED_VISIBLE_MS)
    return () => window.clearTimeout(id)
  }, [finished, endsAt, clear])

  if (endsAt == null) return null
  const remaining = remainingSeconds(endsAt, tick)
  const progress = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100

  // Im Fokusmodus (Workout) ersetzt das Dock das Eingabe-Dock am unteren Rand,
  // sonst sitzt es über der Tab-Leiste.
  const position = `fixed inset-x-0 z-30 mx-auto w-full max-w-xl md:max-w-2xl ${focus ? 'bottom-0' : 'bottom-16 md:bottom-4 md:pl-20 lg:pl-60'}`

  if (finished) {
    return (
      <div
        role="timer"
        aria-live="off"
        className={`${position} safe-bottom bg-primary text-primary-foreground`}
      >
        <button
          type="button"
          aria-label="Timer schließen"
          className="flex w-full items-center justify-between gap-3 px-5 pb-6 pt-4 text-left"
          onClick={clear}
        >
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">
              Pause vorbei
            </span>
            <span className="block font-display text-3xl uppercase leading-tight">
              Ab an die Bank!
            </span>
            <span className="sr-only" data-testid="timer-clock">
              {formatClock(remaining)}
            </span>
          </span>
          <X className="h-6 w-6 shrink-0" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div
      role="timer"
      aria-live="off"
      className={`${position} safe-bottom rounded-t-[28px] bg-foreground text-background`}
    >
      <div className="h-[5px] overflow-hidden rounded-t-[28px]">
        <div
          className="h-full origin-left bg-primary transition-transform"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
      <div className="px-5 pb-6 pt-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">
              Pause · Ziel {formatClock(total)}
            </div>
            <div
              className="font-display text-[50px] leading-none tabular-nums"
              data-testid="timer-clock"
            >
              {formatClock(remaining)}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-[52px] rounded-2xl border-2 border-background bg-transparent text-base font-bold text-background hover:bg-background/10 hover:text-background"
            onClick={() => extend(30)}
          >
            +30 s
          </Button>
          <Button
            type="button"
            className="h-[52px] rounded-2xl text-base font-bold"
            onClick={clear}
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  )
}
