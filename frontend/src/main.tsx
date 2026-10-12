import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { unlockAudio } from '@/lib/sound'
import { queryClient } from '@/lib/query'
import { applyTheme, useSettings } from '@/stores/settings'
import { router } from './router'
import './assets/fonts/fonts.css'
import './index.css'

applyTheme(useSettings.getState().theme)
useSettings.subscribe((s) => applyTheme(s.theme))
// iOS schaltet Web Audio erst nach der ersten Nutzergeste frei
window.addEventListener('pointerdown', unlockAudio, { once: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ queryClient }} />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  </StrictMode>,
)
