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
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data = text ? JSON.parse(text) : undefined
  if (!response.ok) {
    const err = data?.error
    throw new ApiError(
      response.status,
      err?.code ?? 'error',
      err?.message ?? response.statusText,
      err?.details,
    )
  }
  return data as T
}

export type ErrorType<_E> = ApiError
export type BodyType<T> = T
