import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getGetExerciseSettingQueryKey,
  usePutExerciseSetting,
  type ExerciseSettingRead,
} from '@/api'
import { Sheet } from '@/components/ui/sheet'
import { plateLoad } from '@/lib/plates'
import { errorMessage } from '@/lib/query'
import { formatWeight } from '@/lib/weight'

const BAR_PRESETS = [0, 5, 7.5, 10, 15, 20] as const

// Farben angelehnt an Wettkampfscheiben; Höhe nach Gewicht
function plateStyle(kg: number): { className: string; height: string } {
  const height = `${Math.round(40 + Math.min(kg, 25) * 2.4)}%`
  if (kg >= 25) return { className: 'bg-red-600', height }
  if (kg >= 20) return { className: 'bg-blue-600', height }
  if (kg >= 15) return { className: 'bg-yellow-400', height }
  if (kg >= 10) return { className: 'bg-green-600', height }
  if (kg >= 5) return { className: 'bg-slate-100 border border-slate-400', height }
  return { className: 'bg-slate-500', height }
}

function PlateDiagram({ perSide }: { perSide: number[] }) {
  return (
    <div
      aria-hidden
      className="flex h-28 items-center rounded-xl bg-secondary px-3"
      data-testid="plate-diagram"
    >
      {/* Hantelstange bis zum Kragen, dann die Scheiben von innen nach außen */}
      <div className="h-3 w-10 rounded-l bg-slate-400" />
      <div className="h-8 w-2 rounded-sm bg-slate-500" />
      {perSide.map((kg, i) => {
        const s = plateStyle(kg)
        return (
          <div
            key={i}
            className={`mx-[1px] w-4 rounded-sm ${s.className}`}
            style={{ height: s.height }}
          />
        )
      })}
      <div className="h-3 flex-1 rounded-r bg-slate-400" />
    </div>
  )
}

/**
 * Scheibenrechner: zeigt die Scheiben pro Seite für das Gewicht im Dock und erlaubt,
 * das Stangengewicht dieser Übung zu ändern (gilt nur für den eigenen Account).
 */
export function PlateSheet({
  open,
  onOpenChange,
  exerciseId,
  name,
  weight,
  plates,
  setting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseId: number
  name: string
  weight: number
  plates: number[]
  setting: ExerciseSettingRead | undefined
}) {
  const queryClient = useQueryClient()
  const put = usePutExerciseSetting()
  const own = setting?.bar_weight_kg ?? null
  const fallback = setting?.default_bar_weight_kg ?? null
  const bar = own ?? fallback
  const load = bar != null ? plateLoad(weight, bar, plates) : null

  const save = (value: number | null) =>
    put.mutate(
      { exerciseId, data: { bar_weight_kg: value } },
      {
        onSuccess: (saved) =>
          queryClient.setQueryData(getGetExerciseSettingQueryKey(exerciseId), saved),
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Scheibenrechner · ${name}`}>
      <div className="space-y-4 pb-2">
        {bar == null ? (
          <p className="text-sm text-muted-foreground">
            Für diese Übung ist keine Stange hinterlegt. Wähle unten ein Stangengewicht, um den
            Scheibenrechner zu nutzen.
          </p>
        ) : plates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Scheiben ausgewählt – wähle sie in den Einstellungen aus.
          </p>
        ) : !load ? (
          <p className="text-sm text-muted-foreground">
            {formatWeight(weight)} kg ist leichter als die Stange ({formatWeight(bar)} kg).
          </p>
        ) : (
          <div className="space-y-2">
            <PlateDiagram perSide={load.perSide} />
            <p className="font-display text-2xl tabular-nums" data-testid="plate-per-side">
              Je Seite:{' '}
              {load.perSide.length > 0 ? load.perSide.map(formatWeight).join(' + ') : 'nichts'}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatWeight(bar)} kg Stange + 2 × {formatWeight((load.achieved - bar) / 2)} kg ={' '}
              {formatWeight(load.achieved)} kg
            </p>
            {!load.exact && (
              <p className="text-sm font-semibold text-destructive">
                {formatWeight(weight)} kg lässt sich mit deinen Scheiben nicht genau laden –
                nächstmöglich {formatWeight(load.achieved)} kg.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <p id="bar-label" className="text-sm font-semibold">
            Stangengewicht für diese Übung (kg)
          </p>
          <div
            role="radiogroup"
            aria-labelledby="bar-label"
            className="grid grid-cols-6 gap-1 rounded-lg bg-secondary p-1"
          >
            {BAR_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={bar === v}
                disabled={put.isPending}
                className={`rounded-md py-1.5 text-sm font-medium tabular-nums ${
                  bar === v ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => save(v)}
              >
                {v === 0 ? 'Ohne' : formatWeight(v)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {own != null
              ? fallback != null
                ? `Eigener Wert. Standard für dieses Equipment: ${formatWeight(fallback)} kg.`
                : 'Eigener Wert.'
              : fallback != null
                ? 'Standard aus dem Equipment der Übung.'
                : '„Ohne“ eignet sich für Geräte, auf die nur Scheiben gesteckt werden.'}
          </p>
          {own != null && (
            <button
              type="button"
              className="text-sm font-semibold text-primary"
              onClick={() => save(null)}
            >
              {fallback != null
                ? `Auf Standard (${formatWeight(fallback)} kg) zurücksetzen`
                : 'Scheibenrechner für diese Übung ausschalten'}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
