import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginEmblem } from './LoginEmblem'

describe('LoginEmblem', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loops in idle and does not report done', () => {
    const onDone = vi.fn()
    render(<LoginEmblem phase="idle" onDone={onDone} />)
    const emblem = screen.getByTestId('login-emblem')
    expect(emblem).toHaveAttribute('aria-hidden', 'true')
    const ring = emblem.children[1] as HTMLElement
    expect(ring.style.animationName).toBe('chRing')
    expect(ring.style.animationDuration).toBe('2.8s')
    expect(ring.style.animationIterationCount).toBe('infinite')
    act(() => vi.advanceTimersByTime(10_000))
    expect(onDone).not.toHaveBeenCalled()
  })

  it('pulses faster while pending', () => {
    render(<LoginEmblem phase="pending" />)
    const ring = screen.getByTestId('login-emblem').children[1] as HTMLElement
    expect(ring.style.animationDuration).toBe('1.2s')
  })

  it('runs a single muted pulse on error, then reports done', () => {
    const onDone = vi.fn()
    render(<LoginEmblem phase="error" onDone={onDone} />)
    const emblem = screen.getByTestId('login-emblem')
    expect(emblem.style.getPropertyValue('--ch-hit')).toBe('hsl(var(--muted-foreground))')
    act(() => vi.advanceTimersByTime(2_700))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('sends the echo off-screen on success', () => {
    const onDone = vi.fn()
    render(<LoginEmblem phase="success" onDone={onDone} />)
    const echo = screen.getByTestId('login-emblem').children[0] as HTMLElement
    expect(echo.style.animationName).toBe('chEchoOut')
    act(() => vi.advanceTimersByTime(1_200))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
