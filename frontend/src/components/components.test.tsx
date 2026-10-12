import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RestTimer } from './RestTimer'
import { SetEntry } from './SetEntry'
import { Stepper } from './Stepper'
import { useActiveSession } from '@/stores/activeSession'

describe('Stepper', () => {
  it('steps by the configured amount and never below min', async () => {
    const onChange = vi.fn()
    render(<Stepper label="Gewicht" value={1} step={2.5} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Gewicht erhöhen' }))
    expect(onChange).toHaveBeenLastCalledWith(3.5)
    await userEvent.click(screen.getByRole('button', { name: 'Gewicht verringern' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })
})

describe('SetEntry', () => {
  it('is prefilled with previous values and submits adjusted values', async () => {
    const onSubmit = vi.fn()
    render(<SetEntry initialReps={8} initialWeight={60} weightStep={2.5} onSubmit={onSubmit} />)
    expect(screen.getByLabelText('Wiederholungen', { selector: 'output' })).toHaveTextContent('8')
    expect(screen.getByLabelText('Gewicht (kg)', { selector: 'output' })).toHaveTextContent('60')
    await userEvent.click(screen.getByRole('button', { name: 'Gewicht (kg) erhöhen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Wiederholungen verringern' }))
    await userEvent.click(screen.getByRole('button', { name: /Satz abhaken/ }))
    expect(onSubmit).toHaveBeenCalledWith({
      reps: 7,
      weight_kg: 62.5,
      is_warmup: false,
    })
  })

  it('can mark a warmup set', async () => {
    const onSubmit = vi.fn()
    render(<SetEntry initialReps={10} initialWeight={20} weightStep={1.25} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByLabelText('Aufwärmsatz'))
    await userEvent.click(screen.getByRole('button', { name: /Satz abhaken/ }))
    expect(onSubmit).toHaveBeenCalledWith({
      reps: 10,
      weight_kg: 20,
      is_warmup: true,
    })
  })

  it('shows a German decimal comma', () => {
    render(<SetEntry initialReps={5} initialWeight={62.5} weightStep={2.5} onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Gewicht (kg)', { selector: 'output' })).toHaveTextContent('62,5')
  })

  it('hides weight for time based exercises', () => {
    render(
      <SetEntry
        initialReps={30}
        initialWeight={0}
        weightStep={2.5}
        loadType="time"
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.queryByText('Gewicht (kg)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Sekunden', { selector: 'output' })).toHaveTextContent('30')
  })
})

describe('RestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useActiveSession.getState().endSession()
  })

  it('renders nothing without a running timer', () => {
    render(<RestTimer />)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('counts down using the stored end time and survives a long background pause', () => {
    let current = 1_000_000
    const now = () => current
    useActiveSession.getState().startRest(90, current)
    render(<RestTimer now={now} />)
    expect(screen.getByTestId('timer-clock')).toHaveTextContent('1:30')
    current += 30_000
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.getByTestId('timer-clock')).toHaveTextContent('1:00')
    // Bildschirm gesperrt: Timer-Ticks bleiben aus, beim Zurückkehren wird neu berechnet
    current += 55_000
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByTestId('timer-clock')).toHaveTextContent('0:05')
    current += 10_000
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByTestId('timer-clock')).toHaveTextContent('0:00')
    expect(screen.getByText('Pause vorbei')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('can be dismissed', async () => {
    vi.useRealTimers()
    useActiveSession.getState().startRest(60)
    render(<RestTimer />)
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('extends the running pause by 30 seconds', async () => {
    vi.useRealTimers()
    useActiveSession.getState().startRest(60)
    render(<RestTimer />)
    await userEvent.click(screen.getByRole('button', { name: '+30 s' }))
    expect(useActiveSession.getState().restTotalSec).toBe(90)
    expect(screen.getByText('Pause · Ziel 1:30')).toBeInTheDocument()
  })

  it('closes the finished bar on tap', async () => {
    vi.useRealTimers()
    useActiveSession.getState().startRest(60, Date.now() - 120_000)
    render(<RestTimer />)
    expect(screen.getByText('Ab an die Bank!')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Timer schließen' }))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })
})
