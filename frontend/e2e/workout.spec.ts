import { expect, test, type Page } from '@playwright/test'

const ADMIN = { email: 'admin@example.com', password: 'e2e-admin-password' }

const USER = { email: 'anna@example.com', password: 'anna-secret-password', name: 'Anna' }

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
}

test('Einladung → Registrierung → Plan → Workout loggen → Fortschritt', async ({ page }) => {
  // --- Admin erzeugt Einladungscode ---
  await login(page, ADMIN.email, ADMIN.password)
  await expect(page.getByRole('heading', { name: /Heute/ })).toBeVisible()
  await page.goto('/admin')
  await page.getByRole('button', { name: /Einladungscode erzeugen/ }).click()
  const code = (await page.getByTestId('invite-code').textContent())!.trim()
  expect(code.length).toBeGreaterThan(8)

  // --- Abmelden, als neue Nutzerin registrieren ---
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.getByRole('link', { name: /registrieren/ }).click()
  await page.getByLabel('Einladungscode').fill(code)
  await page.getByLabel('Name').fill(USER.name)
  await page.getByLabel('E-Mail').fill(USER.email)
  await page.getByLabel('Passwort').fill(USER.password)
  await page.getByRole('button', { name: 'Registrieren' }).click()
  await expect(page.getByRole('heading', { name: /Heute/ })).toBeVisible()
  await expect(page.getByText('Noch kein aktiver Plan')).toBeVisible()

  // --- Plan mit Trainingstag für heute anlegen ---
  await page.getByRole('link', { name: 'Pläne', exact: true }).click()
  await page.getByLabel('Name des neuen Plans').fill('Push Pull')
  await page.getByRole('button', { name: 'Plan anlegen', exact: true }).click()
  await page.getByRole('link', { name: 'Push Pull' }).click()
  await page.getByLabel('Name des neuen Trainingstags').fill('Push')
  await page.getByRole('button', { name: 'Trainingstag hinzufügen' }).click()
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long' })
  const chip = page.getByRole('group', { name: 'Wochentage' }).getByRole('button', { name: today })
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')

  for (const name of ['Bankdrücken', 'Schulterdrücken']) {
    await page.getByRole('button', { name: 'Übung hinzufügen' }).click()
    await page.getByLabel('Übung suchen').fill(name)
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  }

  // Sätze im Editor per Tastatur ändern: bestehenden Wert löschen und neu tippen
  await page.getByRole('button', { name: 'Schulterdrücken bearbeiten' }).click()
  const sets = page.getByLabel('Sätze', { exact: true })
  await sets.fill('')
  await expect(sets).toHaveValue('')
  await sets.pressSequentially('2')
  await expect(sets).toHaveValue('2')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(/^2 × /).first()).toBeVisible()

  // --- Heute: Plan-Tag erscheint, Workout starten ---
  await page.getByRole('link', { name: 'Heute', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible()
  await expect(page.getByText('Bankdrücken')).toBeVisible()
  await page.getByRole('button', { name: 'Workout starten' }).click()
  await expect(page.getByRole('heading', { name: 'Läuft' })).toBeVisible()
  await expect(page.getByTestId('exercise-title')).toHaveText('Bankdrücken')

  // --- Sätze loggen: Werte im Dock anpassen, abhaken, Pausen-Dock läuft ---
  const doneRows = page.getByTestId('set-row')
  await page.getByRole('button', { name: 'Gewicht (kg) erhöhen' }).click()
  await page.getByRole('button', { name: 'Gewicht (kg) erhöhen' }).click()
  await expect(page.getByTestId('active-row')).toContainText('8 × 25 kg')
  await page.getByRole('button', { name: /Satz abhaken/ }).click()
  await expect(doneRows).toHaveCount(1)
  await expect(doneRows.first()).toContainText('8 × 25 kg')
  await expect(page.getByRole('timer')).toBeVisible()
  await expect(page.getByTestId('timer-clock')).toContainText(/\d:\d\d/)

  // Pause beenden, damit das Eingabe-Dock wieder frei ist
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  // Werte per Tastatur eingeben
  await page.getByRole('textbox', { name: 'Gewicht (kg)' }).fill('22,5')
  await page.getByRole('textbox', { name: 'Wiederholungen' }).fill('6')
  await expect(page.getByTestId('active-row')).toContainText('6 × 22,5 kg')
  await page.getByRole('button', { name: /Satz abhaken/ }).click()
  await expect(doneRows).toHaveCount(2)
  await expect(doneRows.nth(1)).toContainText('6 × 22,5 kg')

  // --- Training beenden, im Verlauf auffindbar ---
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: /Heute/ })).toBeVisible()
  await page.getByRole('link', { name: 'Verlauf', exact: true }).click()
  await expect(page.getByText('1 Übungen · 2 Sätze').or(page.getByText('2 Übungen · 2 Sätze'))).toBeVisible()

  // --- Übungsdetail: Kennzahlen aus den geloggten Sätzen ---
  await page.getByRole('link', { name: 'Übungen', exact: true }).click()
  await page.getByLabel('Übungen suchen').fill('Bankdrücken')
  await page.getByRole('link', { name: /^Bankdrücken/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Bankdrücken' })).toBeVisible()
  // e1RM = 40 * (1 + 8/30) = 31,67 kg (Hero, Hochzähl-Animation läuft aus)
  await expect(page.getByText('31,67').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'e1RM-Verlauf' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Insgesamt' })).toBeVisible()

  // --- Tab Historie: Session mit Sätzen, direkt verlinkbar über ?tab= ---
  await page.getByRole('radio', { name: 'Historie' }).click()
  await expect(page).toHaveURL(/tab=historie/)
  await expect(page.getByText('25 kg × 8')).toBeVisible()
  await expect(page.getByText('22,5 kg × 6')).toBeVisible()

  // --- Einstieg aus Heute: Übungszeile ist ein Link, Zurück führt zur Tagesansicht ---
  await page.getByRole('link', { name: 'Heute', exact: true }).click()
  await page.getByRole('link', { name: /Bankdrücken/ }).click()
  await expect(page.getByRole('heading', { name: 'Bankdrücken' })).toBeVisible()
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible()

  // --- Workout (hier die beendete Session): Titel antippen öffnet die Schnellansicht mit Link zur vollen Seite ---
  await page.getByRole('link', { name: 'Zusammenfassung' }).click()
  await expect(page.getByTestId('exercise-title')).toHaveText('Bankdrücken')
  await page.getByTestId('exercise-title').getByRole('button').click()
  await expect(page.getByRole('dialog').getByText('Nächstes PR-Ziel')).toBeVisible()
  await page.getByRole('link', { name: 'Alle Statistiken' }).click()
  await expect(page).toHaveURL(/\/exercises\/\d+/)
  await expect(page.getByRole('heading', { name: 'Bankdrücken' })).toBeVisible()
})

test('falsche Zugangsdaten zeigen eine Fehlermeldung', async ({ page }) => {
  await login(page, ADMIN.email, 'falsches-passwort-123')
  await expect(page.getByRole('alert')).toContainText('E-Mail oder Passwort falsch')
  await expect(page).toHaveURL(/\/login/)
})

test('geschützte Seiten leiten auf den Login um', async ({ page }) => {
  await page.goto('/plans')
  await expect(page).toHaveURL(/\/login/)
})

test('Beispielplan aus dem Startkatalog anlegen', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password)
  await page.getByRole('link', { name: 'Pläne', exact: true }).click()
  await expect(page.getByText('Noch keine Pläne')).toBeVisible()
  await page.getByRole('button', { name: 'Beispielplan anlegen' }).click()
  await expect(page.getByRole('link', { name: /Beispielplan/ })).toBeVisible()
  await expect(page.getByText(/Push \(Mo\)/)).toBeVisible()
})
