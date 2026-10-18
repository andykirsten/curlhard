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

describe('SetEntry keyboard input', () => {
  it('accepts typed weight (with comma) and reps', async () => {
    const onSubmit = vi.fn()
    render(<SetEntry initialReps={8} initialWeight={60} weightStep={2.5} onSubmit={onSubmit} />)
    const weight = screen.getByLabelText('Gewicht (kg)', { selector: 'input' })
    const reps = screen.getByLabelText('Wiederholungen', { selector: 'input' })
    await userEvent.clear(weight)
    await userEvent.type(weight, '72,5')
    await userEvent.clear(reps)
    await userEvent.type(reps, '12')
    await userEvent.tab()
    expect(weight).toHaveValue('72,5')
    await userEvent.click(screen.getByRole('button', { name: /Satz abhaken/ }))
    expect(onSubmit).toHaveBeenCalledWith({
      reps: 12,
      weight_kg: 72.5,
      is_warmup: false,
      rpe: null,
    })
  })
})

describe('SetEntry', () => {
  it('is prefilled with previous values and submits adjusted values', async () => {
    const onSubmit = vi.fn()
    render(<SetEntry initialReps={8} initialWeight={60} weightStep={2.5} onSubmit={onSubmit} />)
    expect(screen.getByLabelText('Wiederholungen', { selector: 'input' })).toHaveValue('8')
    expect(screen.getByLabelText('Gewicht (kg)', { selector: 'input' })).toHaveValue('60')
    await userEvent.click(screen.getByRole('button', { name: 'Gewicht (kg) erhöhen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Wiederholungen verringern' }))
    await userEvent.click(screen.getByRole('button', { name: /Satz abhaken/ }))
    expect(onSubmit).toHaveBeenCalledWith({
      reps: 7,
      weight_kg: 62.5,
      is_warmup: false,
      rpe: null,
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
      rpe: null,
    })
  })

  it('submits an optional RPE, tapping again clears it', async () => {
    const onSubmit = vi.fn()
    render(<SetEntry initialReps={5} initialWeight={100} weightStep={2.5} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('radio', { name: /RPE 8/ }))
    expect(screen.getByRole('radio', { name: /RPE 8/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: /Satz abhaken/ }))
    expect(onSubmit).toHaveBeenLastCalledWith({ reps: 5, weight_kg: 100, is_warmup: false, rpe: 8 })
    await userEvent.click(screen.getByRole('radio', { name: /RPE 8/ }))
    await userEvent.click(screen.getByRole('button', { name: /Satz abhaken/ }))
    expect(onSubmit).toHaveBeenLastCalledWith({
      reps: 5,
      weight_kg: 100,
      is_warmup: false,
      rpe: null,
    })
  })

  it('shows a German decimal comma', () => {
    render(<SetEntry initialReps={5} initialWeight={62.5} weightStep={2.5} onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Gewicht (kg)', { selector: 'input' })).toHaveValue('62,5')
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
    expect(screen.getByLabelText('Sekunden', { selector: 'input' })).toHaveValue('30')
    expect(screen.queryByRole('radiogroup', { name: /RPE/ })).not.toBeInTheDocument()
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
