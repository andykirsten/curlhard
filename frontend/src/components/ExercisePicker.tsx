import { useState } from 'react'
import { useListExercises, type ExerciseRead } from '@/api'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'

interface ExercisePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (exercise: ExerciseRead) => void
}

export function ExercisePicker({ open, onOpenChange, onPick }: ExercisePickerProps) {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useListExercises({
    search: search || undefined,
    limit: 100,
  })
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Übung wählen">
      <Input
        autoFocus
        placeholder="Übung suchen …"
        aria-label="Übung suchen"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3"
      />
      {isLoading && <p className="p-3 text-muted-foreground">Lädt …</p>}
      <ul className="divide-y">
        {data?.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-2 py-3 text-left hover:bg-accent"
              onClick={() => {
                onPick(ex)
                onOpenChange(false)
                setSearch('')
              }}
            >
              <span>{ex.name}</span>
              {!ex.is_global && <span className="text-xs text-muted-foreground">eigene</span>}
            </button>
          </li>
        ))}
        {data?.length === 0 && <li className="p-3 text-muted-foreground">Keine Treffer.</li>}
      </ul>
    </Sheet>
  )
}
