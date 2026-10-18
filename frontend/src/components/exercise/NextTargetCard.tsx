import { Target } from 'lucide-react'
import type { RepProfilePoint } from '@/api'
import { Card, CardContent } from '@/components/ui/card'
import { prTarget } from '@/lib/exerciseStats'
import { formatWeight } from '@/lib/weight'
import { useSettings } from '@/stores/settings'

const TARGET_REPS = [5, 8, 12] as const

/** Konkrete PR-Ziele („8 × 82,5 kg“) für 5, 8 und 12 Wiederholungen. */
export function NextTargets({ profile, compact }: { profile: RepProfilePoint[]; compact?: boolean }) {
  const step = useSettings((s) => s.weightStep)
  const targets = TARGET_REPS.map((r) => prTarget(profile, r, step)).filter((t) => t != null)
  if (targets.length === 0) return null
  return (
    <ul className={compact ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-3 gap-2 md:gap-3'}>
      {targets.map((t) => (
        <li
          key={t.reps}
          className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-3 text-center"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Neuer {t.reps}RM
          </p>
          <p className="mt-1 font-display text-2xl leading-none tabular-nums md:text-3xl">
            {t.reps} × {formatWeight(t.weight)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            kg{t.current != null ? ` · bisher ${formatWeight(t.current)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

export function NextTargetCard({ profile }: { profile: RepProfilePoint[] }) {
  if (profile.length === 0) return null
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-lg">Nächstes PR-Ziel</h2>
        </div>
        <NextTargets profile={profile} />
        <p className="text-xs text-muted-foreground">
          Mindestens ein Schritt über deinem Bestwert oder die geschätzte Last – je nachdem, was
          höher ist.
        </p>
      </CardContent>
    </Card>
  )
}
