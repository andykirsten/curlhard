import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { buildWeek, planByWeekday } from '@/lib/week'
import { WeekStrip } from './WeekStrip'

const WEEK = buildWeek(
  new Date(2026, 9, 12, 9),
  planByWeekday([{ id: 1, name: 'Ganzkörper B', weekdays: [2] }]),
  false,
)

function Harness() {
  const [selected, setSelected] = useState(0)
  return <WeekStrip week={WEEK} selected={selected} onSelect={setSelected} />
}

describe('WeekStrip', () => {
  it('renders 7 tabs starting today', () => {
    render(<Harness />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(7)
    expect(tabs[0]).toHaveTextContent('Heute')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[2]).toHaveAccessibleName('Mittwoch, 14. Oktober, Ganzkörper B')
    expect(tabs[1]).toHaveAccessibleName('Dienstag, 13. Oktober, Ruhetag')
  })

  it('selects by tap and keyboard', () => {
    render(<Harness />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[2]!)
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(tabs[2]!, { key: 'ArrowRight' })
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(tabs[3]!, { key: 'End' })
    expect(tabs[6]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(tabs[6]!, { key: 'Home' })
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveFocus()
  })
})
