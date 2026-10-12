import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { beep } from '@/lib/sound'
import { formatClock, isFinished, remainingSeconds } from '@/lib/timer'
import { useActiveSession } from '@/stores/activeSession'

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

  if (endsAt == null) return null
  const remaining = remainingSeconds(endsAt, tick)
  const progress = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100

  return (
    <div
      role="timer"
      aria-live="off"
      className={`safe-bottom fixed inset-x-0 z-30 ${focus ? 'bottom-4' : 'bottom-16'} mx-auto w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-xl border shadow-lg ${
        finished ? 'bg-primary text-primary-foreground' : 'bg-card'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-70">
            {finished ? 'Pause vorbei' : 'Pause'}
          </div>
          <div className="font-display text-4xl tabular-nums" data-testid="timer-clock">
            {formatClock(remaining)}
          </div>
        </div>
        <Button
          variant={finished ? 'secondary' : 'ghost'}
          size="icon"
          aria-label="Timer schließen"
          onClick={clear}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="h-1 bg-secondary">
        <div
          className="h-1 origin-left bg-primary transition-transform"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
    </div>
  )
}
