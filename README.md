# Curlhard

Selbst gehosteter Workout-Tracker als PWA (FastAPI + PostgreSQL, Vite/React/TypeScript).
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
| Backend (pytest gegen Postgres, `make db` startet sie; andere DB über `TEST_DATABASE_URL`) | `cd backend && uv run ruff check . && uv run mypy app && uv run pytest` |
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
mit RPE zählt die Reserve mit (`r + min(10 − RPE, 4)`, höchstens 30), Sätze > 30 Wdh. fließen nicht in die Schätzung,
Aufwärmsätze zählen nie. „Veränderung ggü. 4/12 Wochen“ vergleicht die letzten 4 Wochen mit dem
4-Wochen-Fenster, das 4 bzw. 12 Wochen zurückliegt.

## Deployment (Hetzner, Docker Compose, Host-Nginx als TLS-Proxy)

Siehe Abschnitt „Deployment“ im Implementierungsplan. Dateien: `deploy/compose.yaml`,
`deploy/.env.example`, `deploy/nginx-host.conf.example`, `deploy/backup.sh`, `deploy/deploy.sh`,
`frontend/nginx.conf`, CI in `.github/workflows/ci.yml`.

Der `web`-Container lauscht nur auf `127.0.0.1:8080` (HTTP). TLS terminiert ein Nginx auf dem Host in
einem eigenen Server-Block; bestehende Dienste (z. B. BWMS) bleiben unberührt. Ohne eigene Domain dient
`<IP-mit-Bindestrichen>.sslip.io` als Hostname (z. B. `203-0-113-5.sslip.io`).

1. `deploy/.env` aus `.env.example` anlegen (`chmod 600`), `GHCR_OWNER`, `SECRET_KEY`, `POSTGRES_PASSWORD`, `ALLOWED_ORIGINS` (mit sslip-Hostnamen) setzen.
2. `docker compose up -d`, dann einmalig `docker compose run --rm --no-deps --entrypoint python api -m app.seed` und
   `docker compose run --rm --no-deps --entrypoint python api -m app.create_admin EMAIL PASSWORT NAME`.
3. Host-Nginx: `deploy/nginx-host.conf.example` nach `/etc/nginx/sites-available/curlhard`, Platzhalter ersetzen,
   Zertifikat per Host-Certbot (`certbot certonly --webroot -w /var/www/certbot -d <HOST>`), `nginx -t && systemctl reload nginx`.
   Hetzner-Firewall: 443 freigeben.
4. Backup per Host-Cron: `deploy/backup.sh` (`pg_dump -Fc` nach `/var/backups/curlhard`); Update: `deploy/deploy.sh`.
   Restore: `docker compose exec -T db pg_restore -U curlhard -d curlhard --clean --if-exists < curlhard-<STAMP>.dump`.

### Eigene Domain per Cloudflare Tunnel

Alternative zum Host-Nginx, wenn dieser nicht angefasst werden soll (live für `curlhard.com`): Der Dienst
`tunnel` (`cloudflared`) baut eine ausgehende Verbindung zu Cloudflare auf; TLS und DNS übernimmt Cloudflare,
es wird kein Port geöffnet.

1. Im Cloudflare-Dashboard (Zero Trust → Networks → Tunnels) einen Tunnel anlegen, Umgebung „Docker“, Token kopieren.
2. In `deploy/.env`: `COMPOSE_PROFILES=tunnel`, `CLOUDFLARE_TUNNEL_TOKEN=<Token>` und die Domain(s) in
   `ALLOWED_ORIGINS` ergänzen, dann `docker compose up -d`.
3. Public Hostnames des Tunnels (z. B. `curlhard.com`, `www.curlhard.com`) mit Service-URL `http://web:80` anlegen;
   die DNS-Einträge erzeugt Cloudflare selbst.

Die echte Client-IP kommt über `X-Forwarded-For` an (der `web`-Container vertraut dem Docker-Netz), das
Login-Rate-Limit greift also weiterhin pro Client.

### Einmalige Übernahme der alten SQLite-Datenbank

Erst nach dem Merge auf `main` (CI baut die Postgres-fähigen Images). Neue `compose.yaml`, `backup.sh`,
`migrate-to-postgres.sh` nach `/opt/curlhard/deploy` kopieren, `POSTGRES_PASSWORD` in `.env` ergänzen, dann
`./migrate-to-postgres.sh`: neue Images ziehen, SQLite sichern (`/var/backups/curlhard/vor-postgres-*.db`),
`web`/`api` stoppen, Schema anlegen, Daten importieren (Zeilenzahlen werden verglichen, ID-Sequenzen gesetzt,
Quelle darf auf Revision 0005 stehen), Stack starten. Das Volume `deploy_data` bleibt unverändert als Rollback.
Danach Login prüfen und den Restore einmal in einer Wegwerf-Datenbank testen. Echte Daten gehören nie ins
Image (GHCR ist öffentlich), sie liegen im Volume `pgdata`.

### FitNotes-Import

`backend/app/import_fitnotes.py` überträgt ein FitNotes-Backup (`.fitnotes`) in das Konto eines bestehenden Benutzers
(eine Session pro Trainingstag, Übungen ohne Historie werden übersprungen, neue Übungen sind privat; ein zweiter
Import wird abgelehnt). Lokal: `cd backend && uv run python -m app.import_fitnotes ../data/FitNotes_Backup.fitnotes EMAIL [--dry-run]`.
Live (nach dem Postgres-Umstieg): Datei per `scp` nach `/opt/curlhard/deploy/import/` legen, vorher `deploy/backup.sh`, dann
`docker compose run --rm --no-deps -v $PWD/import:/import:ro --entrypoint python api -m app.import_fitnotes /import/FitNotes_Backup.fitnotes EMAIL`.
Die Datei danach vom Server löschen. Der Ordner `data/` ist git-ignoriert.

## Lokale Entwicklung

`make db` startet Postgres (`docker-compose.dev.yaml`, Port 5432, Nutzer/Passwort/DB `curlhard`), `make dev` startet
zusätzlich Backend und Vite. Tests und E2E legen `curlhard_test` bzw. `curlhard_e2e` selbst an.
Schreibende Requests eines Nutzers werden per Postgres-Advisory-Lock (`deps.current_user`) serialisiert.

Noch nicht praktisch geprüft (benötigt Server bzw. Geräte): Image-Builds, TLS/Certbot, Restore-Test,
Test auf echtem iPhone (Safari 15), Usability-Test.

## Startkatalog

`backend/seeds/exercises.json` ist ein handkuratierter deutscher Katalog, angelehnt an
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Lizenz vor einer Übernahme weiterer Daten prüfen).
