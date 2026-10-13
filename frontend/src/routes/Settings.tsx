import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import {
  exportData as fetchExport,
  useChangePassword,
  useDeleteAccount,
  useDeleteAvatar,
  useLogout,
  useMe,
  useUpdateMe,
  useUploadAvatar,
} from '@/api'
import { PageHeader } from '@/components/Layout'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Label } from '@/components/ui/label'
import { resizeAvatar } from '@/lib/avatar'
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
  const uploadAvatar = useUploadAvatar()
  const removeAvatar = useDeleteAvatar()
  const avatarInput = useRef<HTMLInputElement>(null)
  const settings = useSettings()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [resizing, setResizing] = useState(false)
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

  const saveDisplayName = () => {
    const name = (displayName ?? '').trim()
    if (!name || name === me.data?.display_name) {
      setDisplayName(null)
      return
    }
    updateMe.mutate(
      { data: { display_name: name } },
      {
        // Erst nach Erfolg zurücksetzen, sonst springt das Feld kurz auf den alten Namen
        onSuccess: async () => {
          await queryClient.invalidateQueries()
          setDisplayName(null)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  const onAvatarPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setResizing(true)
      const blob = await resizeAvatar(file).finally(() => setResizing(false))
      await uploadAvatar.mutateAsync({
        data: { file: new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) },
      })
      toast.success('Profilbild aktualisiert')
      void queryClient.invalidateQueries()
    } catch (err) {
      toast.error(errorMessage(err))
    }
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
        <Section title="Profil">
          <div className="flex items-center gap-4">
            <Avatar name={me.data?.display_name ?? ''} src={me.data?.avatar_url} size="lg" />
            <div className="flex flex-col items-start gap-2">
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Profilbild auswählen"
                onChange={(e) => void onAvatarPicked(e)}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={resizing || uploadAvatar.isPending}
                onClick={() => avatarInput.current?.click()}
              >
                Bild ändern
              </Button>
              {me.data?.avatar_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removeAvatar.isPending}
                  onClick={() =>
                    removeAvatar.mutate(undefined, {
                      onSuccess: () => {
                        toast.success('Profilbild entfernt')
                        void queryClient.invalidateQueries()
                      },
                      onError: (err) => toast.error(errorMessage(err)),
                    })
                  }
                >
                  Entfernen
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="display-name">Anzeigename</Label>
            <Input
              id="display-name"
              maxLength={120}
              value={displayName ?? me.data?.display_name ?? ''}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={saveDisplayName}
            />
          </div>
        </Section>

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
          <div className="space-y-2">
            <Label id="step-label">Gewichtsschritt</Label>
            <Segmented
              aria-labelledby="step-label"
              value={String(settings.weightStep)}
              options={[
                { value: '1.25', label: '1,25 kg' },
                { value: '2.5', label: '2,5 kg' },
              ]}
              onChange={(v) => settings.set({ weightStep: Number(v) as 1.25 | 2.5 })}
            />
          </div>
          <div className="space-y-2">
            <Label id="theme-label">Darstellung</Label>
            <Segmented
              aria-labelledby="theme-label"
              value={settings.theme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Hell' },
                { value: 'dark', label: 'Dunkel' },
              ]}
              onChange={(v) => settings.set({ theme: v as Theme })}
            />
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
            <Link to="/admin">Administration</Link>
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
