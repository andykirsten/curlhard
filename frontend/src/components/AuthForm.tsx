import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginSchema, registerSchema, type LoginValues, type RegisterValues } from '@/lib/schemas'
import { cn } from '@/lib/utils'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

interface FormProps<T> {
  onSubmit: (values: T) => void
  pending?: boolean
  serverError?: string | null
}

/** Login-Feld im Stil von Redesign A: Label über einer Eingabe mit Unterstrich, aktiv in Orange. */
function LineField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="group flex flex-col gap-1.5">
      <Label className="text-xs font-bold uppercase leading-none tracking-[0.16em] text-muted-foreground group-focus-within:text-primary">
        {label}
      </Label>
      <div
        className={cn(
          'flex items-center gap-3 border-b-2 border-border pb-2.5 pt-1.5 group-focus-within:border-primary',
          error && 'border-destructive',
        )}
      >
        {children}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

const lineInput =
  'min-w-0 flex-1 bg-transparent p-0 text-[21px] font-medium leading-[1.2] outline-none placeholder:text-muted-foreground'

export function LoginForm({
  onSubmit,
  onAttempt,
  pending,
  serverError,
}: FormProps<LoginValues> & { onAttempt?: () => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })
  return (
    <form
      className="flex flex-col gap-[22px]"
      onSubmit={(e) => {
        onAttempt?.()
        return handleSubmit(onSubmit)(e)
      }}
      noValidate
    >
      <LineField label="E-Mail" error={errors.email?.message}>
        <input
          type="email"
          autoComplete="email"
          className={lineInput}
          {...register('email')}
          aria-label="E-Mail"
        />
      </LineField>
      <LineField label="Passwort" error={errors.password?.message}>
        <input
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          className={cn(lineInput, !showPassword && 'tracking-[0.1em]')}
          {...register('password')}
          aria-label="Passwort"
        />
        <button
          type="button"
          aria-pressed={showPassword}
          onClick={() => setShowPassword((v) => !v)}
          className="shrink-0 text-[13px] font-bold uppercase leading-none tracking-[0.12em] text-muted-foreground"
        >
          {showPassword ? 'Verbergen' : 'Zeigen'}
        </button>
      </LineField>
      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="mt-2 h-[66px] w-full justify-between rounded-2xl px-6 font-display text-[28px] font-normal uppercase leading-none disabled:opacity-70"
      >
        <span>Anmelden</span>
        <span aria-hidden="true">→</span>
      </Button>
    </form>
  )
}

export function RegisterForm({ onSubmit, pending, serverError }: FormProps<RegisterValues>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })
  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Einladungscode" error={errors.invite_code?.message}>
        <Input autoComplete="off" {...register('invite_code')} aria-label="Einladungscode" />
      </Field>
      <Field label="Name" error={errors.display_name?.message}>
        <Input autoComplete="name" {...register('display_name')} aria-label="Name" />
      </Field>
      <Field label="E-Mail" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register('email')} aria-label="E-Mail" />
      </Field>
      <Field label="Passwort" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          {...register('password')}
          aria-label="Passwort"
        />
      </Field>
      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        Registrieren
      </Button>
    </form>
  )
}
