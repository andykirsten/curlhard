import { describe, expect, it } from 'vitest'
import { kindFields, kindMark, kindOf } from './setKind'

describe('setKind', () => {
  it('leitet die Art aus is_warmup und set_type ab', () => {
    expect(kindOf({ is_warmup: false })).toBe('normal')
    expect(kindOf({ is_warmup: true, set_type: 'drop' })).toBe('warmup')
    expect(kindOf({ is_warmup: false, set_type: 'drop' })).toBe('drop')
    expect(kindOf({ is_warmup: false, set_type: 'unbekannt' })).toBe('normal')
  })

  it('übersetzt zurück in die API-Felder', () => {
    expect(kindFields('warmup')).toEqual({ is_warmup: true, set_type: 'normal' })
    expect(kindFields('backoff')).toEqual({ is_warmup: false, set_type: 'backoff' })
    expect(kindFields('normal')).toEqual({ is_warmup: false, set_type: 'normal' })
  })

  it('liefert Kürzel nur für besondere Sätze', () => {
    expect(kindMark({ is_warmup: false, set_type: 'normal' })).toBeNull()
    expect(kindMark({ is_warmup: true })).toBe('W')
    expect(kindMark({ is_warmup: false, set_type: 'backoff' })).toBe('B')
  })
})
