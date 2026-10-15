import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PHRASES } from '@/lib/kliment'
import { KlimentPreviewButton } from './KlimentOverlay'

describe('KlimentPreviewButton', () => {
  it('zeigt Kliment mit einer zufälligen Phrase', async () => {
    render(<KlimentPreviewButton rng={() => 0} />)
    expect(screen.queryByTestId('kliment-preview')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Kliment anzeigen' }))
    expect(screen.getByTestId('kliment-preview')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(PHRASES[0])
    await userEvent.click(screen.getByRole('button', { name: 'Kliment ausblenden' }))
    expect(screen.queryByTestId('kliment-preview')).not.toBeInTheDocument()
  })
})
