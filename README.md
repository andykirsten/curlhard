# Curlhard

Selbst gehosteter Workout-Tracker als PWA (FastAPI + SQLite, Vite/React/TypeScript).
Konzept und Architektur: `Curlhard – Implementierungsplan.md`.

## Entwicklung

Voraussetzungen: Python 3.12 mit [uv](https://docs.astral.sh/uv/), Node 22+, optional `make`.

```sh
cd backend && uv sync && uv run alembic upgrade head
uv run python -m app.seed                                   # Startkatalog (idempotent)
uv run python -m app.create_admin admin@example.de "langes-passwort" Admin
make dev                                                    # Backend :8000 + Vite :5173
```

Ohne `make`: Backend mit
`COOKIE_SECURE=false ALLOWED_ORIGINS='["http://localhost:5173"]' uv run uvicorn app.main:app --reload`,
Frontend mit `npm run dev` (Proxy `/api` → 8000).

Nach jeder API-Änderung den Client neu erzeugen: `make api-client`
(= `python -m app.export_openapi` + `npx orval`).

## Tests

| Bereich | Befehl |
| --- | --- |
| Backend (pytest, In-Memory-SQLite) | `cd backend && uv run ruff check . && uv run mypy app && uv run pytest` |
| Frontend (Vitest, Typecheck, Lint) | `cd frontend && npm run lint && npm run typecheck && npm test` |
| Build + iOS-15-CSS-Check | `cd frontend && npm run build && npm run check:compat` |
| E2E (Playwright, startet Backend + Vite selbst) | `cd frontend && npx playwright install chromium && npm run e2e` |

WebKit/Safari-Engine im E2E: `npx playwright install webkit`, dann `E2E_WEBKIT=1 npm run e2e`.
Der Isolationstest (`backend/tests/test_isolation.py`) legt zwei User an und prüft jeden
Endpunkt: fremde Ressourcen liefern 404, ohne Login 401.

## Statistik

`backend/app/services/stats.py` (reine Funktionen, Unit-Tests in `tests/test_stats_unit.py`):
`e1RM = w · f(r)`, nRM `= e1RM / f(n)` mit `f(r) = 1 + r/30` (Epley) bis 15 Wdh., darüber die an Epley
angeschlossene Mayhew-Kurve `f(r) = 1,5 · M(r) / M(15)`, `M(r) = 1 / (0,522 + 0,419 · e^(−0,055 r))`;
Sätze > 30 Wdh. fließen nicht in die Schätzung,
Aufwärmsätze zählen nie. „Veränderung ggü. 4/12 Wochen“ vergleicht die letzten 4 Wochen mit dem
4-Wochen-Fenster, das 4 bzw. 12 Wochen zurückliegt.

## Deployment (Hetzner, Docker Compose, Host-Nginx als TLS-Proxy)

Siehe Abschnitt „Deployment“ im Implementierungsplan. Dateien: `deploy/compose.yaml`,
`deploy/.env.example`, `deploy/nginx-host.conf.example`, `deploy/backup.sh`, `deploy/deploy.sh`,
`frontend/nginx.conf`, CI in `.github/workflows/ci.yml`.

Der `web`-Container lauscht nur auf `127.0.0.1:8080` (HTTP). TLS terminiert ein Nginx auf dem Host in
einem eigenen Server-Block; bestehende Dienste (z. B. BWMS) bleiben unberührt. Ohne eigene Domain dient
`<IP-mit-Bindestrichen>.sslip.io` als Hostname (z. B. `203-0-113-5.sslip.io`).

1. `deploy/.env` aus `.env.example` anlegen (`chmod 600`), `GHCR_OWNER`, `SECRET_KEY`, `ALLOWED_ORIGINS` (mit sslip-Hostnamen) setzen.
2. `docker compose up -d`, dann einmalig `docker compose run --rm --no-deps --entrypoint python api -m app.seed` und
   `docker compose run --rm --no-deps --entrypoint python api -m app.create_admin EMAIL PASSWORT NAME`.
3. Host-Nginx: `deploy/nginx-host.conf.example` nach `/etc/nginx/sites-available/curlhard`, Platzhalter ersetzen,
   Zertifikat per Host-Certbot (`certbot certonly --webroot -w /var/www/certbot -d <HOST>`), `nginx -t && systemctl reload nginx`.
   Hetzner-Firewall: 443 freigeben.
4. Backup per Host-Cron: `deploy/backup.sh`; Update: `deploy/deploy.sh`.

Noch nicht praktisch geprüft (benötigt Server bzw. Geräte): Image-Builds, TLS/Certbot, Restore-Test,
Test auf echtem iPhone (Safari 15), Usability-Test.

## Startkatalog

`backend/seeds/exercises.json` ist ein handkuratierter deutscher Katalog, angelehnt an
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Lizenz vor einer Übernahme weiterer Daten prüfen).
