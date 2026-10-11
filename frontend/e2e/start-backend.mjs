// Startet das Backend für die E2E-Tests mit frischer Datenbank (Migration, Startkatalog, Admin).
import { spawn, execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(here, '../../backend')
const db = path.join(backendDir, 'e2e.db')

for (const suffix of ['', '-wal', '-shm']) {
  if (existsSync(db + suffix)) rmSync(db + suffix)
}

const env = {
  ...process.env,
  DATABASE_URL: `sqlite:///${db.replaceAll('\\', '/')}`,
  COOKIE_SECURE: 'false',
  RATE_LIMIT_PER_MINUTE: '1000',
  // Vite-Dev-Proxy leitet den Host-Header auf :8000 um; der Origin bleibt :5173
  ALLOWED_ORIGINS: '["http://localhost:5173"]',
}
const run = (cmd) => execSync(cmd, { cwd: backendDir, env, stdio: 'inherit' })

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
