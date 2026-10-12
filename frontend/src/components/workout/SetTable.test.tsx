import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LastSet, SetRead } from '@/api'
import { SetTable, type ActiveRow } from './SetTable'

const last = (reps: number, weight_kg: number): LastSet => ({
  reps,
  weight_kg,
  is_warmup: false,
  rpe: null,
})

const done = (id: number, reps: number, weight_kg: number, is_warmup = false): SetRead => ({
  id,
  session_exercise_id: 1,
  exercise_id: 1,
  set_number: id,
  reps,
  weight_kg,
  rest_sec: null,
  rpe: null,
  is_warmup,
  completed_at: '2026-10-12T08:00:00Z',
  records: [],
})

const PREV = [last(8, 60), last(8, 60), last(7, 60), last(6, 60)]

function renderTable(sets: SetRead[], active: ActiveRow | null) {
  return render(
    <SetTable
      sets={sets}
      prevSets={PREV}
      active={active}
      loadType="weight"
      recordsBySet={{}}
      compact={active != null}
      onSelect={() => {}}
    />,
  )
}

describe('SetTable', () => {
  it('shows pending sets from last time as ghost rows', () => {
    renderTable([done(1, 10, 20, true), done(2, 8, 62.5)], {
      number: 2,
      reps: 8,
      weight_kg: 62.5,
      is_warmup: false,
      prev: PREV[1],
    })
    expect(screen.getAllByTestId('set-row')).toHaveLength(2)
    expect(within(screen.getByTestId('active-row')).getByText('8 × 60 kg')).toBeInTheDocument()
    const ghosts = screen.getAllByTestId('ghost-row')
    expect(ghosts.map((g) => g.getAttribute('aria-label'))).toEqual([
      'Satz 3, letztes Mal 7 × 60 kg',
      'Satz 4, letztes Mal 6 × 60 kg',
    ])
    expect(screen.getByLabelText('Satz 1 bearbeiten')).toHaveTextContent('▲ +2,5 kg')
  })

  it('keeps the next working set as ghost while logging a warmup', () => {
    renderTable([], { number: 1, reps: 10, weight_kg: 20, is_warmup: true, prev: undefined })
    expect(screen.getAllByTestId('ghost-row')).toHaveLength(4)
  })

  it('shows no ghost rows for finished sessions', () => {
    renderTable([done(1, 8, 60)], null)
    expect(screen.queryByTestId('ghost-row')).toBeNull()
  })
})
