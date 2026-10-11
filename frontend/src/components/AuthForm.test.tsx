import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm, RegisterForm } from './AuthForm'
import { loginSchema, registerSchema } from '@/lib/schemas'

describe('schemas', () => {
  it('requires a valid e-mail for login', () => {
    expect(loginSchema.safeParse({ email: 'x', password: 'a' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.de', password: 'a' }).success).toBe(true)
  })

  it('enforces 10 character passwords on registration', () => {
    const base = { email: 'a@b.de', display_name: 'A', invite_code: 'x' }
    expect(registerSchema.safeParse({ ...base, password: '123456789' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: '1234567890' }).success).toBe(true)
  })
})

describe('LoginForm', () => {
  it('shows validation errors and does not submit invalid data', async () => {
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    expect(await screen.findByText('Bitte E-Mail eingeben')).toBeInTheDocument()
    expect(screen.getByText('Bitte Passwort eingeben')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects malformed e-mail addresses', async () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('E-Mail'), 'kein-mail')
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim')
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    expect(await screen.findByText('Ungültige E-Mail-Adresse')).toBeInTheDocument()
  })

  it('submits valid values', async () => {
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('E-Mail'), 'a@b.de')
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim')
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { email: 'a@b.de', password: 'geheim' },
        expect.anything(),
      ),
    )
  })

  it('shows server errors clearly', () => {
    render(<LoginForm onSubmit={vi.fn()} serverError="E-Mail oder Passwort falsch" />)
    expect(screen.getByRole('alert')).toHaveTextContent('E-Mail oder Passwort falsch')
  })

  it('disables the button while pending', () => {
    render(<LoginForm onSubmit={vi.fn()} pending />)
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeDisabled()
  })
})

describe('RegisterForm', () => {
  it('requires invite code and long password', async () => {
    const onSubmit = vi.fn()
    render(<RegisterForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('E-Mail'), 'a@b.de')
    await userEvent.type(screen.getByLabelText('Name'), 'Anna')
    await userEvent.type(screen.getByLabelText('Passwort'), 'kurz')
    await userEvent.click(screen.getByRole('button', { name: 'Registrieren' }))
    expect(await screen.findByText('Mindestens 10 Zeichen')).toBeInTheDocument()
    expect(screen.getByText('Einladungscode erforderlich')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
