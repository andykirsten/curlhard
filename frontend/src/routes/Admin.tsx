import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  getGetAppConfigQueryKey,
  useCreateInvite,
  useDeleteInvite,
  useGetAppConfig,
  useListInvites,
  useMe,
  useUpdateAppConfig,
} from '@/api'
import { EmptyState, PageHeader, Spinner } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { formatDate } from '@/lib/dates'
import { errorMessage } from '@/lib/query'

export function AdminPage() {
  const queryClient = useQueryClient()
  const me = useMe()
  const invites = useListInvites()
  const create = useCreateInvite()
  const remove = useDeleteInvite()
  const appConfig = useGetAppConfig()
  const updateConfig = useUpdateAppConfig()
  const [fresh, setFresh] = useState<string | null>(null)

  if (me.data && me.data.role !== 'admin') {
    return (
      <>
        <PageHeader title="Administration" back="/settings" />
        <EmptyState title="Kein Zugriff" hint="Dieser Bereich ist nur für Administratoren." />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Administration" back="/settings" />
      <div className="space-y-4 p-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-medium">Kliment-Modus</div>
              <div className="text-muted-foreground">
                Während eines Workouts taucht ab und zu ein Kopf auf und feuert dich an.
              </div>
            </div>
            <Switch
              label="Kliment-Modus"
              checked={appConfig.data?.kliment_mode ?? false}
              disabled={!appConfig.data || updateConfig.isPending}
              onCheckedChange={(checked) =>
                updateConfig.mutate(
                  { data: { kliment_mode: checked } },
                  {
                    onSuccess: () =>
                      queryClient.invalidateQueries({ queryKey: getGetAppConfigQueryKey() }),
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            />
          </CardContent>
        </Card>
        <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Einladungen</h2>
        <Button
          className="w-full"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(
              { data: { expires_in_days: 7 } },
              {
                onSuccess: (inv) => {
                  setFresh(inv.code)
                  void queryClient.invalidateQueries()
                },
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        >
          Einladungscode erzeugen (7 Tage gültig)
        </Button>
        {fresh && (
          <Card className="border-primary">
            <CardContent className="space-y-2">
              <p className="text-sm">Neuer Code – wird nur jetzt angezeigt:</p>
              <code
                className="block break-all rounded bg-muted p-2 text-lg"
                data-testid="invite-code"
              >
                {fresh}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void navigator.clipboard?.writeText(fresh)}
              >
                Kopieren
              </Button>
            </CardContent>
          </Card>
        )}
        {invites.isLoading && <Spinner />}
        <ul className="space-y-2">
          {invites.data?.map((inv) => (
            <li key={inv.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="text-sm">
                    <div className="font-medium">{inv.used_at ? 'Eingelöst' : 'Offen'}</div>
                    <div className="text-muted-foreground">
                      gültig bis {formatDate(inv.expires_at, 'd. MMM yyyy')}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      remove.mutate(
                        { inviteId: inv.id },
                        {
                          onSuccess: () => void queryClient.invalidateQueries(),
                        },
                      )
                    }
                  >
                    Löschen
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
