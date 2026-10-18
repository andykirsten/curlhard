import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PLATES } from '@/lib/plates'

export type Theme = 'light' | 'dark' | 'system'
export type WeightStep = 1.25 | 2.5

interface SettingsState {
  defaultRestSec: number
  weightStep: WeightStep
  theme: Theme
  /** Vorhandene Scheiben (kg) für den Scheibenrechner */
  plates: number[]
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      defaultRestSec: 90,
      weightStep: 2.5,
      theme: 'system',
      plates: DEFAULT_PLATES,
      set: (patch) => set(patch),
    }),
    { name: 'curlhard-settings' },
  ),
)

export function isDark(theme: Theme, prefersDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && prefersDark)
}

export function applyTheme(theme: Theme): void {
  const prefersDark =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', isDark(theme, prefersDark))
}
