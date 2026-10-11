export function endsAtFrom(durationSec: number, now: number): number {
  return now + durationSec * 1000
}

export function remainingSeconds(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

export function isFinished(endsAt: number, now: number): boolean {
  return now >= endsAt
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
