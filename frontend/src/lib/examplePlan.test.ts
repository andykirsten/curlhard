import { describe, expect, it } from 'vitest'
import type { ExerciseRead } from '@/api'
import { buildExamplePlan } from './examplePlan'

const ex = (id: number, name: string) => ({ id, name }) as ExerciseRead

describe('buildExamplePlan', () => {
  it('maps template exercises to catalog ids', () => {
    const plan = buildExamplePlan([
      ex(1, 'Bankdrücken'),
      ex(2, 'Schulterdrücken'),
      ex(3, 'Kniebeuge'),
    ])
    expect(plan.map((d) => d.name)).toEqual(['Push', 'Beine'])
    expect(plan[0]?.exerciseIds).toEqual([1, 2])
    expect(plan[0]?.weekday).toBe(0)
  })

  it('returns nothing for an empty catalog', () => {
    expect(buildExamplePlan([])).toEqual([])
  })
})
