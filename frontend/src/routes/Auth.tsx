import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useLogin, useRegister } from '@/api'
import { LoginForm, RegisterForm } from '@/components/AuthForm'
import { errorMessage } from '@/lib/query'

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="safe-top mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="font-display text-7xl uppercase leading-none">
          Curl<span className="text-primary">hard</span>
        </h1>
        <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">{title}</p>
      </div>
      {children}
    </main>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const login = useLogin()
  return (
    <AuthShell title="Jeder Satz zählt.">
      <LoginForm
        pending={login.isPending}
        serverError={login.error ? errorMessage(login.error) : null}
        onSubmit={(data) =>
          login.mutate(
            { data },
            {
              onSuccess: async () => {
                await queryClient.invalidateQueries()
                void navigate({ to: '/' })
              },
            },
          )
        }
      />
      <p className="text-center text-sm text-muted-foreground">
        Noch kein Konto?{' '}
        <Link to="/register" className="text-primary underline">
          Mit Einladungscode registrieren
        </Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const register = useRegister()
  return (
    <AuthShell title="Registrieren">
      <RegisterForm
        pending={register.isPending}
        serverError={register.error ? errorMessage(register.error) : null}
        onSubmit={(data) =>
          register.mutate(
            { data },
            {
              onSuccess: async () => {
                await queryClient.invalidateQueries()
                void navigate({ to: '/' })
              },
            },
          )
        }
      />
      <p className="text-center text-sm text-muted-foreground">
        Schon registriert?{' '}
        <Link to="/login" className="text-primary underline">
          Anmelden
        </Link>
      </p>
    </AuthShell>
  )
}
