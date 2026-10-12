import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ambientProfileFor, makeItem, PROFILES } from '@/lib/ambient'
import { AmbientLayer } from './AmbientLayer'

describe('ambient helpers', () => {
  it('maps routes and rest timer to profiles', () => {
    expect(ambientProfileFor('/', false)).toBe('overview')
    expect(ambientProfileFor('/plans/3', true)).toBe('overview')
    expect(ambientProfileFor('/workout/7', false)).toBe('workoutSet')
    expect(ambientProfileFor('/workout/7', true)).toBe('workoutRest')
  })

  it('starts and ends items off-screen and caps accent opacity', () => {
    for (let i = 0; i < 200; i++) {
      const it = makeItem(PROFILES.login, 390, 844, false)
      const offX = (x: number) => x < 0 || x > 390
      const offY = (y: number) => y < 0 || y > 844
      expect(offX(it.x0) || offY(it.y0)).toBe(true)
      expect(offX(it.x1) || offY(it.y1)).toBe(true)
      expect(it.opacity).toBeLessThanOrEqual(0.35)
      expect(it.delay).toBe(0)
    }
    expect(makeItem(PROFILES.workoutSet, 390, 844, false, () => 0).accent).toBe(false)
  })
})

describe('AmbientLayer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('prewarms, spawns up to the limit and stays hidden from assistive tech', () => {
    render(<AmbientLayer profile="login" />)
    const layer = screen.getByTestId('ambient-layer')
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer).toHaveClass('pointer-events-none')
    expect(layer.children).toHaveLength(3)
    act(() => vi.advanceTimersByTime(12_000))
    expect(layer.children.length).toBeLessThanOrEqual(PROFILES.login.max)
    expect(layer.children.length).toBeGreaterThan(3)
  })

  it('removes items after their run', () => {
    render(<AmbientLayer profile="workoutSet" />)
    const layer = screen.getByTestId('ambient-layer')
    expect(layer.children).toHaveLength(1)
    act(() => vi.advanceTimersByTime(61_000))
    // Vorgewärmtes Teil ist durch, Nachschub höchstens eins
    expect(layer.children.length).toBeLessThanOrEqual(1)
  })

  it('renders nothing with reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    render(<AmbientLayer profile="login" />)
    expect(screen.queryByTestId('ambient-layer')).toBeNull()
  })
})
