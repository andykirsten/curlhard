import { useEffect, useState } from 'react'
import { useActiveSession } from '@/stores/activeSession'

/** Profile und Bahnberechnung für die Hintergrund-Ebene (siehe components/AmbientLayer.tsx). */
export type AmbientProfile = 'login' | 'overview' | 'workoutSet' | 'workoutRest'

export interface ProfileSpec {
  /** Max. Teile gleichzeitig */
  max: number
  /** Mittlerer Abstand zwischen zwei neuen Teilen in s (× 0,6–1,4) */
  every: number
  /** Deckkraft der hellen Teile */
  op: number
  /** Dauer eines Durchlaufs in s [min, max] */
  dur: [number, number]
  /** Anteil oranger Akzent-Teile */
  acc: number
}

export const PROFILES: Record<AmbientProfile, ProfileSpec> = {
  login: { max: 5, every: 2.5, op: 0.11, dur: [18, 30], acc: 0.12 },
  overview: { max: 3, every: 5, op: 0.07, dur: [26, 40], acc: 0.08 },
  workoutSet: { max: 1, every: 12, op: 0.045, dur: [40, 60], acc: 0 },
  workoutRest: { max: 4, every: 3, op: 0.09, dur: [16, 26], acc: 0.15 },
}

export type Shape = 'barbell' | 'dumbbell' | 'kettlebell'
// Langhantel 20 %, Kurzhantel und Kettlebell je 40 % (die Langhantel wirkt schnell dominant)
const SHAPES: Shape[] = ['barbell', 'dumbbell', 'dumbbell', 'kettlebell', 'kettlebell']
/** Abstand außerhalb des Screens, in dem Teile starten und enden */
const MARGIN = 90
/** Teile, die beim Öffnen schon mitten im Bild stehen */
export const PREWARM = 3

export interface AmbientItem {
  id: number
  shape: Shape
  x0: number
  y0: number
  x1: number
  y1: number
  r0: number
  r1: number
  /** Dauer in s */
  dur: number
  /** Negativ beim Vorwärmen: Teil steht beim Öffnen schon mitten im Bild */
  delay: number
  scale: number
  accent: boolean
  opacity: number
}

let uid = 0

export function makeItem(
  p: ProfileSpec,
  w: number,
  h: number,
  prewarm: boolean,
  rand: () => number = Math.random,
): AmbientItem {
  const shape = SHAPES[Math.floor(rand() * SHAPES.length)] ?? 'dumbbell'
  const vertical = rand() < 0.25
  const ltr = rand() < 0.5
  let x0: number, y0: number, x1: number, y1: number
  if (vertical) {
    x0 = rand() * w
    x1 = x0 + (rand() - 0.5) * 160
    y0 = -MARGIN
    y1 = h + MARGIN
  } else {
    y0 = rand() * h
    y1 = y0 + (rand() - 0.5) * 300
    x0 = ltr ? -MARGIN : w + MARGIN
    x1 = ltr ? w + MARGIN : -MARGIN
  }
  const r0 = Math.round(rand() * 360)
  const spin = (40 + rand() * 140) * (rand() < 0.5 ? -1 : 1)
  const dur = p.dur[0] + rand() * (p.dur[1] - p.dur[0])
  const accent = rand() < p.acc
  return {
    id: ++uid,
    shape,
    x0,
    y0,
    x1,
    y1,
    r0,
    r1: r0 + spin,
    dur,
    delay: prewarm ? -rand() * dur * 0.8 : 0,
    scale: 0.8 + rand() * 0.8,
    accent,
    // Akzent mit ~2,5-facher Deckkraft, höchstens 35 % (Kontrast bleibt ≥ 4,5:1)
    opacity: accent ? Math.min(0.35, p.op * 2.6) : p.op,
  }
}

export function ambientProfileFor(pathname: string, restRunning: boolean): AmbientProfile {
  if (pathname.startsWith('/workout/')) return restRunning ? 'workoutRest' : 'workoutSet'
  return 'overview'
}

/** true, solange der Pausen-Timer läuft (nicht mehr, sobald „Pause vorbei“ erscheint). */
export function useRestRunning(): boolean {
  const endsAt = useActiveSession((s) => s.restEndsAt)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (endsAt == null) return
    const t = window.setTimeout(() => setNow(Date.now()), Math.max(0, endsAt - Date.now()) + 50)
    return () => window.clearTimeout(t)
  }, [endsAt])
  return endsAt != null && now < endsAt
}
