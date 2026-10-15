import { useSyncExternalStore } from 'react'

/** Reagiert auf eine CSS-Media-Query (z. B. Tablet-Breakpoint für die Sidebar). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  )
}

/** Tailwind `md` (Tablet und größer). */
export const useIsTabletUp = () => useMediaQuery('(min-width: 768px)')
