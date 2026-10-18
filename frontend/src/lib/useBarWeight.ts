import { useGetExerciseSetting } from '@/api'

/** Stangengewicht der Übung: eigener Wert, sonst Standard des Equipments, sonst `null`. */
export function useBarWeight(exerciseId: number, enabled: boolean) {
  const setting = useGetExerciseSetting(exerciseId, { query: { enabled, staleTime: 60_000 } })
  const data = setting.data
  const bar = data ? (data.bar_weight_kg ?? data.default_bar_weight_kg) : null
  return { bar: enabled ? bar : null, setting: data }
}
