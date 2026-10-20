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
    // Handy: eine Spalte, Formular unten (Daumenzone). Tablet: zentrierter Block.
    // Desktop/Tablet quer: Wortmarke links, Formular als Karte rechts.
    <main className="relative min-h-screen overflow-hidden">
      <AmbientLayer profile="login" />
      <div className="pointer-events-none absolute inset-0 origin-top-right md:scale-125 lg:scale-150">
        <LoginEmblem
          phase={phase}
          pulse={pulse}
          onDone={() => {
            if (phase === 'success') void navigate({ to: '/' })
            else setPhase('idle')
          }}
        />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-7 pb-10 pt-[max(48px,env(safe-area-inset-top))] md:max-w-lg md:justify-center md:py-16 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-20 lg:px-16">
        <div>
          <h1 className="mt-[150px] font-display text-[116px] uppercase leading-[0.84] tracking-[-0.01em] md:mt-0 md:text-[136px] lg:text-[clamp(140px,13vw,196px)]">
            Curl
            <br />
            <span className="text-primary">Hard</span>
          </h1>
          <p className="mt-[18px] text-[15px] font-bold uppercase leading-[1.3] tracking-[0.2em] text-muted-foreground lg:text-lg">
            Jeder Satz zählt.
          </p>
        </div>
        <div className="min-h-10 flex-1 md:hidden" />
        <div className="flex flex-col gap-[22px] md:mt-14 lg:mt-0 lg:rounded-3xl lg:border lg:bg-card lg:p-10 lg:shadow-2xl lg:shadow-black/10 lg:[--autofill-bg:hsl(var(--card))]">
          <h2 className="hidden font-display text-3xl uppercase leading-none lg:block">
            Willkommen zurück
          </h2>
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
              className="rounded-sm font-bold text-foreground underline underline-offset-[3px] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Mit Einladungscode registrieren
            </Link>
          </p>
        </div>
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
