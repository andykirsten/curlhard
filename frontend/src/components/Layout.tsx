import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ClipboardList, Dumbbell, History, Home, UserCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { RestTimer } from '@/components/RestTimer'
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
              className="flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
              activeProps={{ className: 'text-primary font-semibold' }}
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
  return (
    <div className="mx-auto min-h-screen max-w-xl pb-40">
      <Outlet />
      <RestTimer />
      <BottomNav />
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
  return (
    <header className="safe-top sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-3">
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
      <h1 className={cn('flex-1 truncate text-xl font-bold')}>{title}</h1>
      {actions}
      {profile && (
        <Link to="/settings" aria-label="Profil und Einstellungen" className="rounded-md p-1.5">
          <UserCircle className="h-7 w-7" />
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
      <p className="text-lg font-semibold">{title}</p>
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
