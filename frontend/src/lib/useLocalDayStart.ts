import { startOfDay } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import { msUntilNextDay } from '@/lib/week'

/**
 * Lokaler Tagesbeginn, der sich um Mitternacht (+500 ms) und beim Zurückkehren der App
 * aus dem Hintergrund aktualisiert. `onReset` läuft in beiden Fällen (Auswahl → heute).
 */
export function useLocalDayStart(onReset?: () => void): Date {
  const [dayStart, setDayStart] = useState(() => startOfDay(new Date()))
  const resetRef = useRef(onReset)
  useEffect(() => {
    resetRef.current = onReset
  })

  useEffect(() => {
    const refresh = () => {
      const next = startOfDay(new Date())
      setDayStart((prev) => (prev.getTime() === next.getTime() ? prev : next))
      resetRef.current?.()
    }
    const timer = window.setTimeout(refresh, msUntilNextDay(new Date()) + 500)
    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [dayStart])

  return dayStart
}
