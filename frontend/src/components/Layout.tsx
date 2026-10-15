import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { ClipboardList, Dumbbell, History, Home } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMe } from '@/api'
import { AmbientLayer } from '@/components/AmbientLayer'
import { RestTimer } from '@/components/RestTimer'
import { Avatar } from '@/components/ui/avatar'
import { ambientProfileFor, useRestRunning } from '@/lib/ambient'
import { cn } from '@/lib/utils'
import { useIsTabletUp } from '@/lib/useMediaQuery'

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

/** Ab Tablet: feste Seitenleiste (Icons, ab Desktop mit Beschriftung) statt Tab-Leiste. */
export function Sidebar() {
  const me = useMe()
  const item =
    'flex h-12 items-center justify-center gap-3 rounded-lg font-display text-sm uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground lg:justify-start lg:px-4'
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-y-0 left-0 z-20 flex w-20 flex-col gap-1 border-r bg-background p-3 lg:w-60"
    >
      <p className="mb-4 hidden px-4 pt-2 font-display text-2xl uppercase text-primary lg:block">
        Curlhard
      </p>
      <ul className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              aria-label={label}
              title={label}
              activeOptions={{ exact: to === '/' }}
              className={item}
              activeProps={{ className: 'bg-accent text-primary' }}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/settings"
        aria-label="Profil und Einstellungen"
        title="Profil und Einstellungen"
        className={cn(item, 'mt-auto')}
      >
        <Avatar name={me.data?.display_name ?? ''} src={me.data?.avatar_url} size="sm" />
        <span className="hidden truncate lg:inline">{me.data?.display_name ?? 'Einstellungen'}</span>
      </Link>
    </nav>
  )
}

export function AppLayout() {
  // Workout läuft im Fokusmodus ohne Tab-Leiste (Design „Curlhard Redesign A“)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const focus = pathname.startsWith('/workout/')
  // Im Workout wird der Hintergrund lebendiger, solange der Pausen-Timer läuft
  const restRunning = useRestRunning()
  // Nur eine Navigation im DOM: Sidebar ab Tablet, sonst Tab-Leiste
  const tabletUp = useIsTabletUp()
  const sidebar = tabletUp && !focus
  return (
    <div
      className={cn(
        'min-h-screen',
        focus ? 'pb-24' : 'pb-40 md:pb-12',
        sidebar && 'md:pl-20 lg:pl-60',
      )}
    >
      <a
        href="#inhalt"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('inhalt')?.focus()
        }}
      >
        Zum Inhalt springen
      </a>
      <div
        className={cn(
          'mx-auto',
          focus ? 'max-w-xl md:max-w-2xl' : 'max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl',
        )}
      >
        <AmbientLayer fixed profile={ambientProfileFor(pathname, restRunning)} />
        {/* positioniert, damit der Inhalt über der Hintergrund-Ebene liegt */}
        <div id="inhalt" tabIndex={-1} className="relative outline-none">
          <Outlet />
        </div>
      </div>
      {focus && <RestTimer focus />}
      {!focus && (sidebar ? <Sidebar /> : <BottomNav />)}
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
