export function roundToStep(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 1000) / 1000
}

export function stepWeight(current: number, direction: 1 | -1, step: number): number {
  const next = roundToStep(current + direction * step, step)
  return next < 0 ? 0 : next
}

export function formatWeight(kg: number): string {
  return String(Math.round(kg * 100) / 100).replace('.', ',')
}

export function parseWeight(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}
