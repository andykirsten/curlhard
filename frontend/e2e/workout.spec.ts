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
  const weekdayIndex = (new Date().getDay() + 6) % 7
  await page.getByLabel('Wochentag').selectOption(String(weekdayIndex))

  for (const name of ['Bankdrücken', 'Schulterdrücken']) {
    await page.getByRole('button', { name: 'Übung hinzufügen' }).click()
    await page.getByLabel('Übung suchen').fill(name)
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  }

  // --- Heute: Plan-Tag erscheint, Workout starten ---
  await page.getByRole('link', { name: 'Heute', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible()
  await expect(page.getByText('Bankdrücken')).toBeVisible()
  await page.getByRole('button', { name: 'Workout starten' }).click()
  await expect(page.getByRole('heading', { name: 'Workout läuft' })).toBeVisible()

  // --- Sätze loggen: Werte anpassen, abhaken, Pausen-Timer läuft ---
  const bench = page.locator('div.rounded-lg', { hasText: 'Bankdrücken' }).first()
  await bench.getByRole('button', { name: 'Gewicht (kg) erhöhen' }).click()
  await bench.getByRole('button', { name: 'Gewicht (kg) erhöhen' }).click()
  await bench.getByRole('button', { name: /Satz abhaken/ }).click()
  await expect(bench.getByText('8 × 25 kg')).toBeVisible()
  await expect(page.getByRole('timer')).toBeVisible()
  await expect(page.getByTestId('timer-clock')).toContainText(/\d:\d\d/)

  await bench.getByRole('button', { name: /Satz abhaken/ }).click()
  await expect(bench.getByText('8 × 25 kg')).toHaveCount(2)

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
  // e1RM = 40 * (1 + 8/30) = 31,67 kg
  await expect(page.getByText('31,67 kg').first()).toBeVisible()
  await expect(page.getByText('Tatsächliche Bestwerte')).toBeVisible()
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
