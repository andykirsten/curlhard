import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    locale: 'de-DE',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    // WebKit (Safari-Engine) nur, wenn installiert: `npx playwright install webkit`
    ...(process.env.E2E_WEBKIT
      ? [{ name: 'webkit', use: { ...devices['iPhone 13'] } }]
      : []),
  ],
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: 'http://localhost:8000/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host localhost',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
