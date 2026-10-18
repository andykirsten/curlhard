import { describe, expect, it } from 'vitest'
import { warmupSets } from './warmup'

describe('warmupSets', () => {
  it('beginnt mit der leeren Stange und steigert auf 40 / 60 / 80 %', () => {
    expect(warmupSets(100, 20, 2.5)).toEqual([
      { reps: 10, weight_kg: 20 },
      { reps: 5, weight_kg: 40 },
      { reps: 3, weight_kg: 60 },
      { reps: 2, weight_kg: 80 },
    ])
  })

  it('rundet auf den Gewichtsschritt', () => {
    expect(warmupSets(40, 10, 2.5)).toEqual([
      { reps: 10, weight_kg: 10 },
      { reps: 5, weight_kg: 15 },
      { reps: 3, weight_kg: 25 },
      { reps: 2, weight_kg: 32.5 },
    ])
  })

  it('lässt Stufen unter der Stange und doppelte Stufen weg', () => {
    expect(warmupSets(30, 20, 2.5)).toEqual([
      { reps: 10, weight_kg: 20 },
      { reps: 2, weight_kg: 25 },
    ])
  })

  it('kommt ohne Stange aus', () => {
    expect(warmupSets(50, null, 2.5)).toEqual([
      { reps: 5, weight_kg: 20 },
      { reps: 3, weight_kg: 30 },
      { reps: 2, weight_kg: 40 },
    ])
  })

  it('schlägt nichts vor, wenn das Arbeitsgewicht die Stange nicht übersteigt', () => {
    expect(warmupSets(20, 20, 2.5)).toEqual([])
    expect(warmupSets(0, null, 2.5)).toEqual([])
  })
})
