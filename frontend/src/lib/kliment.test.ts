import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextDelayMs, PHRASES, pickPhrase, speak, unlockSpeech } from './kliment'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pickPhrase', () => {
  it('covers every phrase with a stubbed rng', () => {
    const n = PHRASES.length
    const picked = PHRASES.map((_, i) => pickPhrase(() => (i + 0.5) / n))
    expect(picked).toEqual([...PHRASES])
  })

  it('stays in range for rng values 0 and just below 1', () => {
    expect(pickPhrase(() => 0)).toBe(PHRASES[0])
    expect(pickPhrase(() => 0.9999999)).toBe(PHRASES[PHRASES.length - 1])
    expect(pickPhrase(() => 1)).toBe(PHRASES[PHRASES.length - 1])
  })
})

describe('nextDelayMs', () => {
  it('is between 45 and 180 seconds', () => {
    expect(nextDelayMs(() => 0)).toBe(45_000)
    expect(nextDelayMs(() => 1)).toBe(180_000)
    for (let i = 0; i < 50; i++) {
      const d = nextDelayMs()
      expect(d).toBeGreaterThanOrEqual(45_000)
      expect(d).toBeLessThanOrEqual(180_000)
    }
  })
})

describe('speak', () => {
  it('speaks German with the lowest pitch and cancels first', () => {
    const calls: string[] = []
    const synth = {
      cancel: vi.fn(() => calls.push('cancel')),
      speak: vi.fn(() => calls.push('speak')),
      getVoices: () => [
        { name: 'Anna', lang: 'de-DE' },
        { name: 'Markus', lang: 'de-DE' },
        { name: 'Daniel', lang: 'en-GB' },
      ],
    }
    class Utter {
      lang = ''
      pitch = 1
      rate = 1
      volume = 1
      voice: unknown = null
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Utter)
    vi.stubGlobal('speechSynthesis', synth)
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })

    speak('Los jetzt!')

    expect(calls).toEqual(['cancel', 'speak'])
    const u = synth.speak.mock.calls[0] as unknown as [Utter]
    expect(u[0].text).toBe('Los jetzt!')
    expect(u[0].lang).toBe('de-DE')
    expect(u[0].pitch).toBeLessThanOrEqual(0.15)
    expect((u[0].voice as { name: string }).name).toBe('Markus')
  })

  it('does not throw without speech support', () => {
    expect(() => speak('Komm schon!')).not.toThrow()
    expect(() => unlockSpeech()).not.toThrow()
  })
})
