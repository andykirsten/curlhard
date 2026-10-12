import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseStrip, type ExerciseStripItem } from './ExerciseStrip'

const ITEMS: ExerciseStripItem[] = [
  { id: 1, name: 'Bankdrücken', progress: { done: 3, target: 3, status: 'done' } },
  { id: 2, name: 'Kniebeuge', progress: { done: 2, target: 4, status: 'started' } },
  { id: 3, name: 'Rudern', progress: { done: 0, target: 3, status: 'open' } },
  { id: 4, name: 'Curls', progress: { done: 1, target: null, status: 'started' } },
]

function Harness({ onAdd }: { onAdd?: () => void }) {
  const [selected, setSelected] = useState(1)
  return <ExerciseStrip items={ITEMS} selected={selected} onSelect={setSelected} onAdd={onAdd} />
}

describe('ExerciseStrip', () => {
  it('renders one tab per exercise with progress', () => {
    render(<Harness />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveTextContent('✓')
    expect(tabs[0]).toHaveAccessibleName('Übung 1: Bankdrücken, 3 von 3 Sätzen, erledigt')
    expect(tabs[1]).toHaveTextContent('2/4')
    expect(tabs[3]).toHaveAccessibleName('Übung 4: Curls, 1 Satz')
    expect(screen.queryByRole('button', { name: 'Übung hinzufügen' })).toBeNull()
  })

  it('selects by tap and keyboard', () => {
    render(<Harness />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[2]!)
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(tabs[2]!, { key: 'ArrowLeft' })
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(tabs[1]!, { key: 'End' })
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(tabs[3]!, { key: 'Home' })
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveFocus()
  })

  it('offers an add tile when a handler is given', () => {
    const onAdd = vi.fn()
    render(<Harness onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: 'Übung hinzufügen' }))
    expect(onAdd).toHaveBeenCalledOnce()
  })
})
