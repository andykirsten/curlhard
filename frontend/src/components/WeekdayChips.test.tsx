import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { WeekdayChips } from './WeekdayChips'

function Harness({ initial = [] as number[] }) {
  const [value, setValue] = useState(initial)
  return <WeekdayChips value={value} taken={{ 2: 'Push' }} onChange={setValue} />
}

describe('WeekdayChips', () => {
  it('toggles several weekdays', () => {
    render(<Harness />)
    expect(screen.getByText('Frei wählbar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Montag' }))
    fireEvent.click(screen.getByRole('button', { name: 'Freitag' }))
    expect(screen.getByRole('button', { name: 'Montag' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2× pro Woche · Mo, Fr')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Montag' }))
    expect(screen.getByRole('button', { name: 'Montag' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Freitag')).toBeInTheDocument()
  })

  it('applies a preset and hints at clashes', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Mo · Mi · Fr' }))
    expect(screen.getByText('3× pro Woche · Mo, Mi, Fr')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mo · Mi · Fr' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mittwoch (auch „Push“)' })).toBeInTheDocument()
    expect(screen.getByText(/Mi: auch „Push“/)).toBeInTheDocument()
  })
})
