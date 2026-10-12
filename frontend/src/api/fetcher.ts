export class ApiError extends Error {
  status: number
  code: string
  details: unknown

  constructor(status: number, code: string, message: string, details: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const customFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  // Bei FormData setzt der Browser den Content-Type samt Boundary selbst
  const isForm = options.body instanceof FormData
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
  })
  if (response.status === 204) return undefined as T
  const text = await response.text()
  let data: unknown = undefined
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }
  if (!response.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | undefined)
      ?.error
    if (err) {
      throw new ApiError(response.status, err.code ?? 'error', err.message ?? response.statusText, err.details)
    }
    throw new ApiError(
      response.status,
      'error',
      response.status >= 500 ? 'Serverfehler – bitte erneut versuchen' : response.statusText || 'Fehler',
      undefined,
    )
  }
  return data as T
}

export type ErrorType<_E> = ApiError
export type BodyType<T> = T
