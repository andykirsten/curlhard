import { describe, expect, it } from 'vitest'
import { reorderIds } from './reorder'

describe('reorderIds', () => {
  it('moves an item down', () => {
    expect(reorderIds([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4])
  })

  it('moves an item up', () => {
    expect(reorderIds([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3])
  })

  it('keeps the order when dropped on itself or on unknown ids', () => {
    expect(reorderIds([1, 2, 3], 2, 2)).toEqual([1, 2, 3])
    expect(reorderIds([1, 2, 3], 9, 2)).toEqual([1, 2, 3])
  })
})
