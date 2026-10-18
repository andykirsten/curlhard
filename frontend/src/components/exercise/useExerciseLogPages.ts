import { useInfiniteQuery } from '@tanstack/react-query'
import { exerciseLog, getExerciseLogQueryKey, type LogRead } from '@/api'

/** Historie seitenweise (Cursor `next_before`); gemeinsamer Hook für Tab und Schnellansicht. */
export function useExerciseLogPages(exerciseId: number, limit = 20) {
  return useInfiniteQuery({
    queryKey: [...getExerciseLogQueryKey(exerciseId, { limit }), 'pages'],
    queryFn: ({ pageParam, signal }): Promise<LogRead> =>
      exerciseLog(exerciseId, { limit, before: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_before ?? undefined,
  })
}
