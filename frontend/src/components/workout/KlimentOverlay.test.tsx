import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PHRASES } from '@/lib/kliment'
import { KlimentOverlay } from './KlimentOverlay'

const speakMock = vi.fn()
const cancelMock = vi.fn()

class Utter {
  lang = ''
  pitch = 1
  rate = 1
  voice: unknown = null
  constructor(public text: string) {}
}

beforeEach(() => {
  vi.useFakeTimers()
  speakMock.mockClear()
  cancelMock.mockClear()
  vi.stubGlobal('SpeechSynthesisUtterance', Utter)
  Object.defineProperty(window, 'speechSynthesis', {
    value: { speak: speakMock, cancel: cancelMock, getVoices: () => [] },
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'speechSynthesis')
})

// erster Auftritt nach 10 s; rng = 0 -> danach 20 s Wartezeit, erste Phrase
const rng = () => 0

describe('KlimentOverlay', () => {
  it('appears after the delay, shows a phrase, speaks and hides again', () => {
    render(<KlimentOverlay rng={rng} />)
    expect(screen.queryByTestId('kliment-overlay')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(9_000)
    })
    expect(screen.queryByTestId('kliment-overlay')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByTestId('kliment-overlay')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(PHRASES[0])
    expect(speakMock).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(3_500)
    })
    expect(screen.queryByTestId('kliment-overlay')).toBeNull()
  })

  it('shows up again after the next delay', () => {
    render(<KlimentOverlay rng={rng} />)
    act(() => {
      vi.advanceTimersByTime(10_000 + 3_500 + 20_000)
    })
    expect(screen.getByTestId('kliment-overlay')).toBeInTheDocument()
    expect(speakMock).toHaveBeenCalledTimes(2)
  })

  it('appears earlier with intensity "oft"', () => {
    render(<KlimentOverlay rng={rng} intensity="oft" />)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByTestId('kliment-overlay')).toBeInTheDocument()
  })

  it('does not fire while the document is hidden', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    render(<KlimentOverlay rng={rng} />)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.queryByTestId('kliment-overlay')).toBeNull()
    expect(speakMock).not.toHaveBeenCalled()
    hidden.mockRestore()
  })

  it('dismisses on tap', () => {
    render(<KlimentOverlay rng={rng} />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kliment ausblenden' }))
    expect(screen.queryByTestId('kliment-overlay')).toBeNull()
  })

  it('still shows the bubble without speech support and cleans up timers on unmount', () => {
    Reflect.deleteProperty(window, 'speechSynthesis')
    const { unmount } = render(<KlimentOverlay rng={rng} />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
