// Startet das Backend für die E2E-Tests mit frischer Datenbank (Migration, Startkatalog, Admin).
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(here, '../../backend')
// Postgres aus docker-compose.dev.yaml (`make db`); frisches Schema in der Datenbank curlhard_e2e
const base = process.env.E2E_DATABASE_URL ?? 'postgresql+psycopg://curlhard:curlhard@localhost:5432'

const env = {
  ...process.env,
  DATABASE_URL: `${base}/curlhard_e2e`,
  COOKIE_SECURE: 'false',
  RATE_LIMIT_PER_MINUTE: '1000',
  // Vite-Dev-Proxy leitet den Host-Header auf :8000 um; der Origin bleibt :5173
  ALLOWED_ORIGINS: '["http://localhost:5173"]',
}
const run = (cmd) => execSync(cmd, { cwd: backendDir, env, stdio: 'inherit' })

run(`uv run python -m app.reset_db ${base}/curlhard_e2e`)
run('uv run alembic upgrade head')
run('uv run python -m app.seed')
run('uv run python -m app.create_admin admin@example.com e2e-admin-password Admin')

const server = spawn('uv', ['run', 'uvicorn', 'app.main:app', '--port', '8000'], {
  cwd: backendDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
const stop = () => server.kill()
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
server.on('exit', (code) => process.exit(code ?? 0))
