import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, customFetch } from './fetcher'

function mockFetch(response: Response) {
  const fn = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('customFetch', () => {
  it('wirft ApiError aus dem JSON-Fehler-Envelope', async () => {
    mockFetch(
      new Response(
        JSON.stringify({ error: { code: 'conflict', message: 'Konflikt', details: { x: 1 } } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const err = await customFetch('/api/v1/x').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, code: 'conflict', message: 'Konflikt', details: { x: 1 } })
  })

  it('behandelt Plain-Text-500 ohne SyntaxError', async () => {
    mockFetch(new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }))
    const err = await customFetch('/api/v1/x').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 500, code: 'error', message: 'Serverfehler – bitte erneut versuchen' })
  })

  it('nutzt statusText bei Client-Fehlern ohne Envelope', async () => {
    mockFetch(new Response('nope', { status: 404, statusText: 'Not Found' }))
    const err = await customFetch('/api/v1/x').catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 404, code: 'error', message: 'Not Found' })
  })

  it('gibt bei 204 undefined zurück', async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(customFetch('/api/v1/x')).resolves.toBeUndefined()
  })

  it('gibt bei OK mit unparsebarem Body undefined zurück', async () => {
    mockFetch(new Response('<html>', { status: 200 }))
    await expect(customFetch('/api/v1/x')).resolves.toBeUndefined()
  })

  it('setzt bei FormData keinen JSON-Content-Type', async () => {
    const fn = mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const form = new FormData()
    form.append('file', new Blob(['abc']), 'a.png')
    await customFetch('/api/v1/upload', { method: 'POST', body: form })
    const init = fn.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    expect(init.credentials).toBe('include')
  })

  it('setzt bei JSON-Bodies den JSON-Content-Type', async () => {
    const fn = mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await customFetch('/api/v1/x', { method: 'POST', body: JSON.stringify({}) })
    const init = fn.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })
})
