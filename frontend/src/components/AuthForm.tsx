import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginSchema, registerSchema, type LoginValues, type RegisterValues } from '@/lib/schemas'

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

export function LoginForm({ onSubmit, pending, serverError }: FormProps<LoginValues>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })
  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="E-Mail" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register('email')} aria-label="E-Mail" />
      </Field>
      <Field label="Passwort" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="current-password"
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
        Anmelden
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
