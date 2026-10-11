import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/fetcher'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
})

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const errors = (error.details as { errors?: { loc: (string | number)[]; msg: string }[] })
      ?.errors
    if (error.code === 'validation_error' && errors?.length) {
      return errors.map((e) => `${e.loc.slice(1).join('.')}: ${e.msg}`).join('; ')
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Unbekannter Fehler'
}
