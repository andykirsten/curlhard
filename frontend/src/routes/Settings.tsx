import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  exportData as fetchExport,
  useChangePassword,
  useDeleteAccount,
  useLogout,
  useMe,
  useUpdateMe,
} from '@/api'
import { PageHeader } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/query'
import { formatWeight, parseWeight } from '@/lib/weight'
import { useActiveSession } from '@/stores/activeSession'
import { useSettings, type Theme } from '@/stores/settings'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useMe()
  const updateMe = useUpdateMe()
  const logout = useLogout()
  const changePassword = useChangePassword()
  const deleteAccount = useDeleteAccount()
  const settings = useSettings()
  const [bodyWeight, setBodyWeight] = useState<string | null>(null)
  const [pw, setPw] = useState({ current: '', next: '' })
  const [deletePw, setDeletePw] = useState('')

  const leave = async () => {
    useActiveSession.getState().endSession()
    queryClient.clear()
    void navigate({ to: '/login' })
  }

  const saveBodyWeight = () => {
    const raw = bodyWeight ?? ''
    const parsed = raw.trim() === '' ? null : parseWeight(raw)
    if (raw.trim() !== '' && parsed == null) return toast.error('Ungültiges Körpergewicht')
    updateMe.mutate(
      { data: { body_weight_kg: parsed } },
      {
        onSuccess: () => {
          toast.success('Gespeichert')
          void queryClient.invalidateQueries()
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  const exportData = async () => {
    const data = await fetchExport()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'curlhard-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader title="Einstellungen" back="/" />
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Angemeldet als <strong>{me.data?.display_name}</strong> ({me.data?.email})
        </p>

        <Section title="Training">
          <div className="space-y-1">
            <Label htmlFor="bw">Körpergewicht (kg)</Label>
            <div className="flex gap-2">
              <Input
                id="bw"
                inputMode="decimal"
                placeholder="z. B. 82,5"
                value={
                  bodyWeight ??
                  (me.data?.body_weight_kg != null ? formatWeight(me.data.body_weight_kg) : '')
                }
                onChange={(e) => setBodyWeight(e.target.value)}
              />
              <Button onClick={saveBodyWeight}>Speichern</Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rest">Standard-Pause (Sekunden)</Label>
            <Input
              id="rest"
              type="number"
              inputMode="numeric"
              min={0}
              value={settings.defaultRestSec}
              onChange={(e) =>
                settings.set({
                  defaultRestSec: Math.max(0, Number(e.target.value)),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="step">Gewichtsschritt</Label>
            <Select
              id="step"
              value={settings.weightStep}
              onChange={(e) =>
                settings.set({
                  weightStep: Number(e.target.value) as 1.25 | 2.5,
                })
              }
            >
              <option value={1.25}>1,25 kg</option>
              <option value={2.5}>2,5 kg</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="theme">Darstellung</Label>
            <Select
              id="theme"
              value={settings.theme}
              onChange={(e) => settings.set({ theme: e.target.value as Theme })}
            >
              <option value="system">System</option>
              <option value="light">Hell</option>
              <option value="dark">Dunkel</option>
            </Select>
          </div>
        </Section>

        <Section title="Passwort ändern">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              changePassword.mutate(
                {
                  data: { current_password: pw.current, new_password: pw.next },
                },
                {
                  onSuccess: () => {
                    toast.success('Passwort geändert')
                    setPw({ current: '', next: '' })
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                },
              )
            }}
          >
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Aktuelles Passwort"
              aria-label="Aktuelles Passwort"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Neues Passwort (mind. 10 Zeichen)"
              aria-label="Neues Passwort"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
            />
            <Button type="submit" variant="secondary" disabled={changePassword.isPending}>
              Passwort ändern
            </Button>
          </form>
        </Section>

        <Section title="Daten &amp; Datenschutz">
          <Button variant="outline" onClick={() => void exportData()}>
            Daten exportieren (JSON)
          </Button>
          <Link to="/privacy" className="block text-sm text-primary underline">
            Datenschutzerklärung
          </Link>
          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="del">Konto und alle Daten löschen</Label>
            <Input
              id="del"
              type="password"
              placeholder="Passwort zur Bestätigung"
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
            />
            <Button
              variant="destructive"
              disabled={!deletePw}
              onClick={() => {
                if (!confirm('Konto wirklich unwiderruflich löschen?')) return
                deleteAccount.mutate(
                  { data: { password: deletePw } },
                  {
                    onSuccess: () => void leave(),
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }}
            >
              Konto löschen
            </Button>
          </div>
        </Section>

        {me.data?.role === 'admin' && (
          <Button asChild variant="secondary" className="w-full">
            <Link to="/admin">Administration (Einladungen)</Link>
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => logout.mutate(undefined, { onSettled: () => void leave() })}
        >
          Abmelden
        </Button>
      </div>
    </>
  )
}
