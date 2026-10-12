import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatElapsed } from '@/lib/workout'

/** Kopf der laufenden Session: pulsierendes „Läuft“, Laufzeit hh:mm:ss, Beenden. */
export function WorkoutHeader({
  startedAt,
  pending,
  onFinish,
}: {
  startedAt: string
  pending?: boolean
  onFinish: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const elapsed = formatElapsed(now - new Date(startedAt).getTime())

  return (
    <header className="safe-top flex items-start justify-between gap-3 px-5 pb-3 pt-4">
      <div>
        <h1 className="flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-primary">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-primary motion-safe:animate-[curlhard-pulse_1.4s_ease-in-out_infinite]"
          />
          Läuft
        </h1>
        <p
          className="font-display text-[30px] leading-tight tabular-nums"
          aria-label="Laufzeit"
          data-testid="elapsed"
        >
          {elapsed}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="rounded-xl border-2 border-foreground px-4 py-[11px] text-sm font-bold uppercase tracking-wide"
        onClick={onFinish}
      >
        Beenden
      </Button>
    </header>
  )
}
