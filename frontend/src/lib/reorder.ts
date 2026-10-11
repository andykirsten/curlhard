import { arrayMove } from '@dnd-kit/sortable'

/** Neue Reihenfolge der IDs nach einem Drag & Drop. */
export function reorderIds(ids: number[], activeId: number, overId: number): number[] {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return ids
  return arrayMove(ids, from, to)
}
