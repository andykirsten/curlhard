import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { ClipboardList, Dumbbell, History, Home } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMe } from '@/api'
import { AmbientLayer } from '@/components/AmbientLayer'
import { RestTimer } from '@/components/RestTimer'
import { Avatar } from '@/components/ui/avatar'
import { ambientProfileFor, useRestRunning } from '@/lib/ambient'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Heute', icon: Home },
  { to: '/plans', label: 'Pläne', icon: ClipboardList },
  { to: '/history', label: 'Verlauf', icon: History },
  { to: '/exercises', label: 'Übungen', icon: Dumbbell },
] as const

export function BottomNav() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t bg-background"
    >
      <ul className="mx-auto flex max-w-xl">
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === '/' }}
              className="flex h-16 flex-col items-center justify-center gap-1 font-display text-xs uppercase tracking-wider text-muted-foreground"
              activeProps={{ className: 'text-primary' }}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function AppLayout() {
  // Workout läuft im Fokusmodus ohne Tab-Leiste (Design „Curlhard Redesign A“)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const focus = pathname.startsWith('/workout/')
  // Im Workout wird der Hintergrund lebendiger, solange der Pausen-Timer läuft
  const restRunning = useRestRunning()
  return (
    <div className={cn('mx-auto min-h-screen max-w-xl', focus ? 'pb-24' : 'pb-40')}>
      <AmbientLayer fixed profile={ambientProfileFor(pathname, restRunning)} />
      {/* positioniert, damit der Inhalt über der Hintergrund-Ebene liegt */}
      <div className="relative">
        <Outlet />
      </div>
      <RestTimer focus={focus} />
      {!focus && <BottomNav />}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  back?: string
  actions?: ReactNode
  profile?: boolean
}

export function PageHeader({ title, back, actions, profile }: PageHeaderProps) {
  const navigate = useNavigate()
  const me = useMe()
  return (
    <header className="safe-top sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
      {back && (
        <button
          type="button"
          aria-label="Zurück"
          className="-ml-2 rounded-md px-2 py-1 text-lg"
          onClick={() => void navigate({ to: back })}
        >
          ←
        </button>
      )}
      <h1 className={cn('flex-1 truncate text-2xl')}>{title}</h1>
      {actions}
      {profile && (
        <Link to="/settings" aria-label="Profil und Einstellungen" className="rounded-md p-1.5">
          <Avatar name={me.data?.display_name ?? ''} src={me.data?.avatar_url} size="sm" />
        </Link>
      )}
    </header>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Dumbbell className="h-10 w-10 text-muted-foreground" aria-hidden />
      <p className="font-display text-2xl uppercase">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  )
}

export function Spinner({ label = 'Lädt …' }: { label?: string }) {
  return (
    <p role="status" className="p-6 text-center text-muted-foreground">
      {label}
    </p>
  )
}
