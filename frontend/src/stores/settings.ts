import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type WeightStep = 1.25 | 2.5

interface SettingsState {
  defaultRestSec: number
  weightStep: WeightStep
  theme: Theme
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      defaultRestSec: 90,
      weightStep: 2.5,
      theme: 'system',
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
