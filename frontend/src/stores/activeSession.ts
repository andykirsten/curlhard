import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { endsAtFrom } from '@/lib/timer'

interface ActiveSessionState {
  sessionId: number | null
  restEndsAt: number | null
  restTotalSec: number
  startSession: (id: number) => void
  endSession: () => void
  startRest: (sec: number, now?: number) => void
  clearRest: () => void
  extendRest: (sec: number, now?: number) => void
}

export const useActiveSession = create<ActiveSessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      restEndsAt: null,
      restTotalSec: 0,
      startSession: (id) => set({ sessionId: id, restEndsAt: null, restTotalSec: 0 }),
      endSession: () => set({ sessionId: null, restEndsAt: null, restTotalSec: 0 }),
      startRest: (sec, now = Date.now()) =>
        set({ restEndsAt: endsAtFrom(sec, now), restTotalSec: sec }),
      clearRest: () => set({ restEndsAt: null, restTotalSec: 0 }),
      extendRest: (sec, now = Date.now()) =>
        set((s) => {
          if (s.restEndsAt == null) return s
          // Abgelaufene Pause: ab jetzt neu zählen, sonst Endzeit verlängern
          if (s.restEndsAt <= now) {
            return { restEndsAt: endsAtFrom(sec, now), restTotalSec: sec }
          }
          return { restEndsAt: s.restEndsAt + sec * 1000, restTotalSec: s.restTotalSec + sec }
        }),
    }),
    { name: 'curlhard-active-session' },
  ),
)
