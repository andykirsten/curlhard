import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useLogin, useRegister } from '@/api'
import { AmbientLayer } from '@/components/AmbientLayer'
import { LoginForm, RegisterForm } from '@/components/AuthForm'
import { LoginEmblem, type EmblemPhase } from '@/components/LoginEmblem'
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
  const [phase, setPhase] = useState<EmblemPhase>('idle')
  const [pulse, setPulse] = useState(0)
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden px-7 pb-10 pt-[max(48px,env(safe-area-inset-top))]">
      <AmbientLayer profile="login" />
      <LoginEmblem
        phase={phase}
        pulse={pulse}
        onDone={() => {
          if (phase === 'success') void navigate({ to: '/' })
          else setPhase('idle')
        }}
      />
      <h1 className="relative mt-[150px] font-display text-[116px] uppercase leading-[0.84] tracking-[-0.01em]">
        Curl
        <br />
        <span className="text-primary">Hard</span>
      </h1>
      <p className="relative mt-[18px] text-[15px] font-bold uppercase leading-[1.3] tracking-[0.2em] text-muted-foreground">
        Jeder Satz zählt.
      </p>
      <div className="min-h-10 flex-1" />
      <div className="relative flex flex-col gap-[22px]">
        <LoginForm
          pending={login.isPending || phase === 'success'}
          serverError={login.error ? errorMessage(login.error) : null}
          onAttempt={() => setPulse((p) => p + 1)}
          onSubmit={(data) => {
            setPhase('pending')
            login.mutate(
              { data },
              {
                onSuccess: async () => {
                  await queryClient.invalidateQueries()
                  // Navigation erst nach dem letzten Puls (LoginEmblem ruft onDone)
                  setPhase('success')
                },
                onError: () => setPhase('error'),
              },
            )
          }}
        />
        <p className="text-center text-[15px] font-medium leading-[1.4] text-muted-foreground">
          Noch kein Konto?{' '}
          <Link
            to="/register"
            className="font-bold text-foreground underline underline-offset-[3px]"
          >
            Mit Einladungscode registrieren
          </Link>
        </p>
      </div>
    </main>
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
