import { beforeEach, describe, expect, it } from 'vitest'
import { useActiveSession } from './activeSession'
import { applyTheme, isDark, useSettings } from './settings'

describe('activeSession store', () => {
  beforeEach(() => useActiveSession.getState().endSession())

  it('starts and ends a session', () => {
    useActiveSession.getState().startSession(7)
    expect(useActiveSession.getState().sessionId).toBe(7)
    useActiveSession.getState().endSession()
    expect(useActiveSession.getState().sessionId).toBeNull()
  })

  it('stores an absolute end time for the rest timer', () => {
    useActiveSession.getState().startRest(90, 1_000)
    const s = useActiveSession.getState()
    expect(s.restEndsAt).toBe(91_000)
    expect(s.restTotalSec).toBe(90)
  })

  it('clears the rest timer', () => {
    useActiveSession.getState().startRest(60, 0)
    useActiveSession.getState().clearRest()
    expect(useActiveSession.getState().restEndsAt).toBeNull()
  })

  it('persists to localStorage', () => {
    useActiveSession.getState().startSession(3)
    const raw = localStorage.getItem('curlhard-active-session')
    expect(raw).toContain('"sessionId":3')
  })

  it('starting a new session resets the timer', () => {
    useActiveSession.getState().startRest(60, 0)
    useActiveSession.getState().startSession(9)
    expect(useActiveSession.getState().restEndsAt).toBeNull()
  })
})

describe('settings store', () => {
  it('has sensible defaults', () => {
    const s = useSettings.getState()
    expect(s.defaultRestSec).toBe(90)
    expect(s.weightStep).toBe(2.5)
  })

  it('updates and persists values', () => {
    useSettings.getState().set({ weightStep: 1.25, defaultRestSec: 120 })
    expect(useSettings.getState().weightStep).toBe(1.25)
    expect(localStorage.getItem('curlhard-settings')).toContain('120')
  })

  it('resolves dark mode', () => {
    expect(isDark('dark', false)).toBe(true)
    expect(isDark('light', true)).toBe(false)
    expect(isDark('system', true)).toBe(true)
  })

  it('toggles the dark class on <html>', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
