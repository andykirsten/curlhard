import type { ExerciseRead } from '@/api'

export interface ExampleDay {
  name: string
  weekday: number
  exerciseIds: number[]
}

const TEMPLATE: { name: string; weekday: number; exercises: string[] }[] = [
  {
    name: 'Push',
    weekday: 0,
    exercises: ['Bankdrücken', 'Schulterdrücken', 'Trizepsdrücken am Kabel'],
  },
  { name: 'Pull', weekday: 2, exercises: ['Klimmzüge', 'Langhantelrudern', 'Langhantelcurls'] },
  {
    name: 'Beine',
    weekday: 4,
    exercises: ['Kniebeuge', 'Rumänisches Kreuzheben', 'Wadenheben stehend'],
  },
]

/** Baut einen Beispielplan aus dem Katalog; fehlende Übungen werden übersprungen. */
export function buildExamplePlan(catalog: ExerciseRead[]): ExampleDay[] {
  const byName = new Map(catalog.map((e) => [e.name, e.id]))
  return TEMPLATE.map((day) => ({
    name: day.name,
    weekday: day.weekday,
    exerciseIds: day.exercises.flatMap((n) => {
      const id = byName.get(n)
      return id == null ? [] : [id]
    }),
  })).filter((d) => d.exerciseIds.length > 0)
}
