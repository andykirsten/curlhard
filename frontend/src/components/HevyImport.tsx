import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { useImportHevy, type ImportResult } from '@/api'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { importLines } from '@/lib/importSummary'
import { errorMessage } from '@/lib/query'

/** Hevy-Import: Datei wählen → Vorschau (Trockenlauf) → bestätigen. Nichts wird vorher gespeichert. */
export function HevyImport() {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const run = useImportHevy()
  const [preview, setPreview] = useState<{ file: File; result: ImportResult } | null>(null)

  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // dieselbe Datei muss erneut wählbar sein
    if (!file) return
    run.mutate(
      { data: { file }, params: { dry_run: true } },
      {
        onSuccess: (result) => setPreview({ file, result }),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const confirm = () => {
    if (!preview) return
    run.mutate(
      { data: { file: preview.file }, params: { dry_run: false } },
      {
        onSuccess: async (result) => {
          setPreview(null)
          toast.success(
            result.sessions === 1 ? '1 Training importiert' : `${result.sessions} Trainings importiert`,
          )
          await queryClient.invalidateQueries()
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <div className="space-y-1">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label="Hevy-Export auswählen"
        onChange={onPicked}
      />
      <Button
        variant="outline"
        className="min-h-[44px]"
        disabled={run.isPending}
        onClick={() => input.current?.click()}
      >
        Aus Hevy importieren (CSV)
      </Button>
      <p className="text-xs text-muted-foreground">
        Hevy → Profil → Einstellungen → Daten exportieren. Du siehst vorher eine Vorschau.
      </p>
      <Sheet open={preview != null} onOpenChange={(o) => !o && setPreview(null)} title="Import-Vorschau">
        {preview && (
          <div className="space-y-4 pb-2">
            <ul className="space-y-1 text-sm" data-testid="import-preview">
              {importLines(preview.result).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {preview.result.sessions === 0 && (
              <p className="text-sm text-muted-foreground">Es gibt nichts Neues zu importieren.</p>
            )}
            <div className="flex gap-2">
              <Button
                className="min-h-[44px] flex-1"
                disabled={run.isPending || preview.result.sessions === 0}
                onClick={confirm}
              >
                Importieren
              </Button>
              <Button
                variant="outline"
                className="min-h-[44px] flex-1"
                disabled={run.isPending}
                onClick={() => setPreview(null)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
