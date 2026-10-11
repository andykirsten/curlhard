# Curlhard – Implementierungsplan

Oct 10, 2026 · @Andy

## Ziel und Scope

Curlhard ist ein selbst gehosteter Workout-Tracker als PWA: angemeldete User stellen Trainingspläne aus globalen Stammdaten-Übungen zusammen, legen sie auf Wochentage, loggen ihre Sätze und sehen pro Übung ihre Progression.

**Funktionsumfang v1**

- Registrierung per Einladungscode, Login, Logout, Passwort ändern
- Übungskatalog: globale Stammdaten (Pflege durch Admin) plus eigene, private Übungen pro User
- Trainingspläne mit Trainingstagen, Zuordnung zu Wochentagen, Übungen mit Ziel-Sätzen, Ziel-Wiederholungen und Ziel-Pause
- Workout-Logging pro Satz: Wiederholungen, Gewicht, tatsächliche Pause, Aufwärmsatz-Flag, optional RPE
- Memos pro Übung: dauerhaft (z. B. Sitzeinstellung) und pro Session
- Pausen-Timer mit Ton
- Progression pro Übung: Volumen, e1RM, geschätzte 5RM, 8RM, 13RM, tatsächliche Bestwerte, Verlaufsgraphen

**Zielplattformen:** Mobile-first im Browser, installierbar als PWA. Untergrenze ist Safari 15 (iPhone 7 / 6s mit iOS 15), daneben aktuelle Chrome-, Firefox- und Safari-Versionen auf Desktop und Android.

**Nicht-Ziele v1:** native Apps, Social Features, Ernährungstracking, Push-Benachrichtigungen, Offline-Logging (vorbereitet, aber erst Phase 6), Mehrsprachigkeit (UI auf Deutsch).

## Architektur und Tech-Stack

Alles läuft per Docker Compose auf einem Ubuntu-Server bei Hetzner: ein Nginx-Container vor einem FastAPI-Container, der eine SQLite-Datei auf einem Docker-Volume nutzt. Die Zugriffsregeln liegen ausschließlich im Backend. Bei erwarteten 2 Usern hat SQLite reichlich Reserve.

&#91;embedded content: Architektur · 4 Schichten plus Backup\]

Das Frontend kennt die API nur über den aus dem OpenAPI-Schema generierten Client, deshalb fallen Abweichungen schon beim TypeScript-Build auf.

| Schicht | Technologie |
| --- | --- |
| Frontend | Vite, React, TypeScript, Tailwind CSS 3.4, shadcn/ui, TanStack Query + Router, Zustand, React Hook Form + Zod, Recharts, dnd-kit, vite-plugin-pwa |
| API-Client | orval (generiert aus OpenAPI) |
| Backend | Python 3.12, FastAPI, SQLModel, Alembic, pwdlib (Argon2), uv |
| Datenbank | SQLite im WAL-Modus |
| Betrieb | Hetzner Cloud, Ubuntu 24.04, Docker Compose (Container api und web), Nginx, Certbot, restic, GHCR |

## Datenmodell

Muskelgruppen und Equipment sind globale Stammdaten ohne `user_id`. Übungen sind entweder global (Admin-Katalog, `owner_user_id` leer) oder privat (`owner_user_id` gesetzt, nur für diesen User sichtbar). Jede andere fachliche Tabelle trägt eine `user_id` und ist dadurch strikt pro User isoliert. Alle Tabellen haben `id` (Integer PK), `created_at` und `updated_at`.

**Globale Stammdaten**

| Tabelle | Wichtige Felder | Hinweise |
| --- | --- | --- |
| `user` | email (unique), password\_hash, display\_name, role (`user`/`admin`), is\_active, body\_weight\_kg | Körpergewicht optional, für Körpergewichtsübungen |
| `muscle_group` | name | Brust, Rücken, Beine … |
| `equipment` | name | Langhantel, Kurzhantel, Maschine, Kabel, Körpergewicht |
| `exercise` | name, description, owner\_user\_id (nullable), primary\_muscle\_group\_id, equipment\_id, load\_type (`weight`/`bodyweight`/`assisted`/`time`), is\_active | Global: nur Admins schreiben; privat: nur der Eigentümer. Name eindeutig pro Eigentümer. Löschen = `is_active=false`, damit Historie erhalten bleibt |
| `exercise_secondary_muscle` | exercise\_id, muscle\_group\_id | n:m für Nebenmuskeln |
| `invite_code` | code\_hash, created\_by\_user\_id, expires\_at, used\_by\_user\_id, used\_at | Einmal-Code für die Registrierung, vom Admin erzeugt |

**Startkatalog:** einmaliger Import aus einem öffentlichen Datensatz, z. B. free-exercise-db (freie Lizenz, vor dem Import prüfen). Namen, Muskelgruppen und Equipment werden beim Import auf die deutschen Stammdaten gemappt.

**Pro User (alle mit `user_id`)**

| Tabelle | Wichtige Felder | Hinweise |
| --- | --- | --- |
| `plan` | name, description, is\_active | Mehrere Pläne möglich, einer aktiv |
| `plan_day` | plan\_id, name, weekday (0–6, nullable), position | z. B. „Push“ auf Montag; ohne Wochentag = frei wählbar |
| `plan_exercise` | plan\_day\_id, exercise\_id, position, target\_sets, target\_reps\_min, target\_reps\_max, target\_rest\_sec, note | Wiederholungsbereich statt fixer Zahl, z. B. 8–12 |
| `workout_session` | plan\_day\_id (nullable), started\_at, finished\_at, note | Auch freie Sessions ohne Plan |
| `session_exercise` | session\_id, exercise\_id, position, note | Reihenfolge und Session-Memo pro Übung |
| `set_log` | session\_exercise\_id, set\_number, reps, weight\_kg, rest\_sec, rpe (nullable), is\_warmup, completed\_at | Kern der Statistik; Gewicht als Dezimalzahl |
| `exercise_note` | exercise\_id, note | Dauerhaftes Memo pro User und Übung (unique auf user\_id + exercise\_id) |

**Regeln**

- `user_id` wird redundant auch auf `plan_day`, `plan_exercise`, `session_exercise` und `set_log` gespeichert. So filtert jede Query direkt, ohne Joins bis zur Wurzel, und Indizes auf `(user_id, exercise_id, completed_at)` machen die Statistik schnell.
- Fremdschlüssel auf `exercise` mit `ON DELETE RESTRICT`; innerhalb eines Users kaskadierendes Löschen (Plan löschen löscht Tage und Plan-Übungen, aber keine Sessions).
- Gewichte ausschließlich in kg, keine Umschaltung auf lbs.
- SQLite-Pragmas bei jeder Verbindung: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`.

## API-Design

REST unter `/api/v1`, JSON, Auth per httpOnly-Session-Cookie; die `user_id` kommt immer aus der Session, nie aus Request-Body oder URL.

| Bereich | Endpunkte | Zugriff |
| --- | --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` | öffentlich (Registrierung nur mit gültigem `invite_code`) bzw. angemeldet |
| Stammdaten lesen | `GET /exercises?search=&muscle_group=&equipment=`, `GET /exercises/{id}`, `GET /muscle-groups`, `GET /equipment` | angemeldet; liefert globale plus eigene private Übungen |
| Stammdaten pflegen | `POST/PATCH /exercises`, `POST/PATCH /muscle-groups`, `POST/PATCH /equipment` | Admin für globale Einträge; `POST/PATCH /exercises` auch für User (legt private Übung an, ändert nur eigene) |
| Einladungen | `GET/POST /admin/invites`, `DELETE /admin/invites/{id}` | Admin |
| Pläne | `GET/POST /plans`, `GET/PATCH/DELETE /plans/{id}`, `POST /plans/{id}/activate`, `POST /plans/{id}/days`, `PATCH/DELETE /plan-days/{id}`, `POST /plan-days/{id}/exercises`, `PATCH/DELETE /plan-exercises/{id}`, `PUT /plan-days/{id}/order` | eigener User |
| Heute | `GET /today` → Plan-Tag für den aktuellen Wochentag inkl. letzter Werte pro Übung | eigener User |
| Sessions | `POST /sessions` (optional `plan_day_id`), `GET /sessions?from=&to=`, `GET/PATCH/DELETE /sessions/{id}`, `POST /sessions/{id}/finish` | eigener User |
| Sätze | `POST /sessions/{id}/exercises`, `POST /session-exercises/{id}/sets`, `PATCH/DELETE /sets/{id}` | eigener User |
| Memos | `GET/PUT /exercises/{id}/note` | eigener User |
| Statistik | `GET /stats/exercises/{id}/summary`, `GET /stats/exercises/{id}/history?from=&to=&metric=e1rm\|volume\|best_set`, `GET /stats/exercises/{id}/records`, `GET /stats/overview?weeks=12` | eigener User |

**Konventionen**

- Pydantic-Schemas getrennt nach `Create`, `Update` (alle Felder optional) und `Read`.
- Fehlerformat einheitlich: `{"error": {"code": "not_found", "message": "…", "details": {…}}}`.
- Ressourcen anderer User liefern **404**, nicht 403, damit IDs nicht ausgespäht werden können.
- Listen mit `limit`/`offset`, Datumsangaben als ISO 8601 in UTC; das Frontend rechnet in lokale Zeit um.
- OpenAPI-Schema unter `/api/openapi.json` ist die Quelle für die generierten Frontend-Typen.

## Statistik und Progression

Alle Kennzahlen werden zur Laufzeit aus `set_log` berechnet, Aufwärmsätze zählen nie mit. Die Berechnung liegt in einem eigenen Python-Modul `stats.py` mit Unit-Tests, die SQL-Queries liefern nur die Rohdaten pro Session.

**Effektive Last** pro Satz: bei `weight` das eingetragene Gewicht, bei `bodyweight` Körpergewicht plus Zusatzgewicht, bei `assisted` Körpergewicht minus Unterstützung. Zeitübungen haben keine RM-Werte, nur Dauer.

**Volumen** einer Session für eine Übung (w = effektive Last, r = Wiederholungen):

```latex
V = \sum_{\text{Sätze}} r_i \cdot w_i
```

**Geschätztes 1RM nach Epley** pro Satz; bei r = 1 gilt e1RM = w:

```latex
e1RM = w \cdot \left(1 + \frac{r}{30}\right)
```

Pro Session zählt der Satz mit dem höchsten e1RM. Sätze mit mehr als 15 Wiederholungen fließen nicht in die Schätzung ein, weil die Formel dort stark streut.

**Geschätztes nRM** für n = 5, 8, 13, abgeleitet aus dem e1RM der Session:

```latex
nRM = \frac{e1RM}{1 + \frac{n}{30}}
```

Beispiel: 80 kg × 8 Wiederholungen ergibt ein e1RM von 101,3 kg, daraus 5RM 86,9 kg und 13RM 70,7 kg.

**Tatsächliche Bestwerte** werden getrennt angezeigt: das höchste Gewicht, das in einem Arbeitssatz mit mindestens n Wiederholungen geschafft wurde, für n = 1, 5, 8, 13, jeweils mit Datum. So sieht der User, was geschätzt und was real ist.

**Endpunkte und Darstellung**

- `summary`: aktuelles e1RM, 5RM, 8RM, 13RM (aus den letzten 4 Wochen), Veränderung gegenüber 4 und 12 Wochen davor in Prozent.
- `history`: eine Zeile pro Session mit Datum, Volumen, bestem Satz, e1RM und abgeleiteten nRM. Das Frontend zeichnet e1RM als Linie und Volumen als Balken darunter.
- `records`: Tabelle der tatsächlichen Bestwerte; ein neuer Rekord wird beim Speichern eines Satzes erkannt und im Workout als Badge angezeigt.
- `overview`: Wochenvolumen gesamt und pro Muskelgruppe, Anzahl Sessions pro Woche.

**Performance:** Index auf `set_log(user_id, exercise_id, completed_at)`. Bei mehreren Jahren Daten pro User bleibt das im Millisekundenbereich; eine vorberechnete Tabelle ist erst nötig, wenn Messungen das zeigen.

## Frontend

Mobile-first mit vier Bereichen in einer Bottom-Navigation: Heute, Pläne, Verlauf, Übungen; Einstellungen und Admin liegen hinter dem Profil-Icon.

| Screen | Inhalt | Wichtige Interaktion |
| --- | --- | --- |
| Login / Registrierung | E-Mail, Passwort | Zod-Validierung, klare Fehlermeldungen |
| Heute | Plan-Tag des aktuellen Wochentags, Übungen mit Zielwerten und letzten Werten | „Workout starten“ legt die Session an; ohne Plan-Tag: freie Session oder anderen Tag wählen |
| Aktives Workout | Übung für Übung, Satzliste, Eingabe Wiederholungen und Gewicht, Pausen-Timer, Memos | Werte des letzten Mals vorbelegt, +/- Stepper (Gewicht in 1,25/2,5 kg), Satz abhaken startet den Timer, Rekord-Badge |
| Pläne | Liste der Pläne, aktiver Plan markiert | Plan duplizieren, aktivieren |
| Plan-Editor | Trainingstage mit Wochentag, Übungen pro Tag | Drag & Drop (dnd-kit) für Reihenfolge, Übungssuche als Bottom Sheet |
| Verlauf | Kalender bzw. Liste vergangener Sessions | Session öffnen, nachträglich korrigieren |
| Übungsdetail | Kennzahlen-Karten (e1RM, 5/8/13RM, Volumen), Graphen, Bestwerte, dauerhaftes Memo | Zeitraum 4 Wochen / 3 Monate / 1 Jahr / alles |
| Übungskatalog | Suche, Filter nach Muskelgruppe und Equipment | Eigene private Übung anlegen und bearbeiten (markiert); Admin: globale anlegen, bearbeiten, deaktivieren |
| Einstellungen | Körpergewicht, Standard-Pause, Gewichtsschritte, Dark Mode, Passwort | in localStorage gespiegelt für schnellen Start |

**Technik**

- Vite + React + TypeScript, Tailwind CSS **3.4**, shadcn/ui, lucide-react, sonner, Motion
- TanStack Query mit Optimistic Updates beim Satz-Logging; TanStack Router mit Lazy Loading pro Route
- React Hook Form + Zod; Zustand (mit `persist`) für die aktive Session und den Timer
- API-Client und Typen generiert mit orval aus `openapi.json`
- Recharts für Graphen, dnd-kit für Drag & Drop, date-fns mit deutscher Locale
- vite-plugin-pwa: Manifest, Icons, Service Worker für App-Shell-Caching

**Kompatibilität iOS 15**

- `build.target: ['es2020', 'safari15']`, CSS ohne `color-mix()`, `@property` und `:has()`
- Timer rechnet mit gespeichertem Endzeitpunkt, nicht mit `setInterval`; beim Zurückkehren in die App wird neu berechnet
- Pausenende per Web Audio API (nach erstem Tap freigeschaltet) plus visuelle Anzeige; keine Vibration API, kein Web Push
- `backdrop-blur` sparsam, Animationen nur auf `transform` und `opacity`
- Safe-Area-Insets (`env(safe-area-inset-bottom)`) für die Bottom-Navigation
- Test auf echtem Gerät in jeder Phase, nicht nur im Desktop-Simulator

## Sicherheit und Datenschutz

Die User-Isolation hängt an einer einzigen Stelle im Backend und wird durch Tests erzwungen, weil SQLite keine Row-Level-Security bietet.

- **Isolation:** Eine FastAPI-Dependency `current_user` liefert den User aus der Session. Alle User-Daten laufen über Repository-Funktionen, die `user_id` als Pflichtparameter haben und in jedes `WHERE` setzen. Ein Integrationstest legt zwei User an und prüft für jeden Endpunkt, dass User B die Daten von A weder lesen noch ändern kann, private Übungen eingeschlossen.
- **Sessions:** Serverseitige Session-Tabelle mit zufälligem Token (32 Byte) im Cookie, `HttpOnly`, `Secure`, `SameSite=Lax`, 30 Tage gleitende Laufzeit. Logout und Passwortänderung invalidieren Sessions. Serverseitige Sessions statt JWT, weil sie sich sofort widerrufen lassen.
- **CSRF:** Frontend und API auf derselben Domain; zusätzlich Prüfung des `Origin`-Headers bei schreibenden Requests.
- **Passwörter:** Argon2id über `pwdlib`, Mindestlänge 10 Zeichen.
- **Brute Force:** Rate-Limit auf Login und Registrierung, in Nginx (`limit_req`) und in der App.
- **Registrierung:** nur mit Einladungscode. Der Admin erzeugt Einmal-Codes mit Ablaufdatum; gespeichert wird nur der Hash, beim Registrieren wird der Code atomar als verbraucht markiert.
- **Header:** HSTS, `X-Content-Type-Options`, Content-Security-Policy ohne Inline-Scripts, gesetzt in Nginx.
- **DSGVO:** Gesundheitsnahe Daten (Körpergewicht, Trainingsdaten). Datenexport als JSON und Account-Löschung mit allen Daten als Endpunkte, kurze Datenschutzerklärung, Server in der EU (Hetzner, Deutschland), keine externen Tracker oder CDNs zur Laufzeit.
- **Backups:** verschlüsselt, wenn sie den Server verlassen.

## Projektstruktur und Entwicklungs-Workflow

Ein Monorepo mit `backend/` und `frontend/`; das Backend ist die Quelle für das API-Schema, das Frontend generiert daraus seinen Client.

```
curlhard/
  backend/
    app/
      main.py            # App, Middleware, Router-Registrierung
      config.py          # Settings über pydantic-settings / .env
      db.py              # Engine, Session, SQLite-Pragmas
      models/            # SQLModel-Tabellen
      schemas/           # Create/Update/Read-Schemas
      repositories/      # DB-Zugriff, immer mit user_id
      routers/           # auth, exercises, plans, sessions, stats, admin
      services/          # stats.py, records.py, auth.py, invites.py
      deps.py            # current_user, require_admin, db_session
      seed.py            # Import des Übungskatalogs
    migrations/          # Alembic
    seeds/exercises.json # Startkatalog aus öffentlichem Datensatz, gemappt
    tests/
    pyproject.toml       # uv
    Dockerfile           # python:3.12-slim, uv, Non-Root
  frontend/
    src/
      api/               # von orval generiert
      routes/            # TanStack Router, ein Ordner pro Bereich
      components/ui/     # shadcn/ui
      components/        # eigene Komponenten (SetRow, RestTimer, Charts …)
      stores/            # Zustand (activeSession, settings)
      lib/               # Formatierung, Gewichtsrechnung
    package.json
    nginx.conf           # SPA-Routing, /api-Proxy, TLS, Header
    Dockerfile           # Multi-Stage: node build → nginx:alpine
  deploy/
    compose.yaml
    .env.example
    backup.sh
    deploy.sh
  .github/workflows/ci.yml
  Makefile
```

**Workflow**

- `make dev`: Uvicorn mit Reload auf Port 8000, Vite-Dev-Server auf 5173 mit Proxy `/api` → 8000
- `make api-client`: OpenAPI-Schema exportieren und orval ausführen; nach jeder API-Änderung
- `make migrate`: Alembic-Migration erzeugen bzw. anwenden
- `make up`: kompletter Stack per `docker compose up --build` lokal, produktionsnah zum Testen der Images
- Qualität: Backend mit ruff, mypy, pytest (In-Memory-SQLite); Frontend mit ESLint, TypeScript strict, Vitest für Rechenlogik, Playwright für den Workout-Flow inkl. WebKit
- Git mit Feature-Branches; eine GitHub Action führt Lint und Tests aus, baut die Docker-Images und pusht sie nach GHCR

## Deployment mit Docker auf Hetzner

Docker Compose mit zwei dauerhaft laufenden Containern: `web` (Nginx) terminiert TLS, liefert das statische Frontend aus und leitet `/api` an `api` (FastAPI/Uvicorn) weiter; die SQLite-Datei liegt auf einem benannten Volume. Images baut die CI, auf dem Server wird nur gezogen und gestartet. Nur `web` veröffentlicht Ports, `api` ist ausschließlich im internen Compose-Netz erreichbar.

1. Server: Hetzner Cloud (z. B. CX22, Standort Falkenstein oder Nürnberg), Ubuntu 24.04 LTS, Docker Engine mit Compose-Plugin aus dem offiziellen Docker-Repository. Hetzner-Cloud-Firewall nur 22, 80, 443 (Docker umgeht `ufw` bei veröffentlichten Ports, deshalb die Firewall vor dem Server); SSH nur mit Key. Domain ebenfalls über Hetzner.
2. Image `curlhard-api` (`backend/Dockerfile`): Build-Stage mit `uv sync --frozen --no-dev`, Laufzeit `python:3.12-slim` als Non-Root-User, `sqlite3`-CLI für Backups. Entrypoint: `alembic upgrade head`, dann `uvicorn app.main:app --host 0.0.0.0 --port 8000` mit **einem** Worker (SQLite verträgt einen Schreibprozess am besten).
3. Image `curlhard-web` (`frontend/Dockerfile`): Multi-Stage, `node:22` mit `npm ci && npm run build`, danach `nginx:alpine` mit `dist/` und `nginx.conf`.
4. CI: GitHub Action baut beide Images, taggt mit Git-SHA und `latest` und pusht nach GHCR (privat).
5. `compose.yaml` (Auszug, siehe unten): `restart: unless-stopped`, `api` mit `read_only: true` plus Volume `/data`, Healthcheck auf `/api/health`, Log-Rotation über `json-file`.
6. Konfiguration: `.env` neben `compose.yaml` (Rechte 600) mit `SECRET_KEY`, `DATABASE_URL=sqlite:////data/curlhard.db`, `CURLHARD_TAG`; per `env_file` in `api` geladen.
7. Nginx im `web`-Container: `try_files $uri /index.html` für das SPA-Routing, `location /api` → `http://api:8000`, Cache-Header lang für gehashte Assets und `no-cache` für `index.html` und den Service Worker, gzip, `limit_req` auf `/api/v1/auth`, Security-Header.
8. TLS: Auf dem Server läuft bereits ein Host-Nginx (BWMS), der Ports 80/443 belegt und unverändert bleibt. Er terminiert TLS für Curlhard in einem eigenen Server-Block (`deploy/nginx-host.conf.example`) und leitet an `127.0.0.1:8080` (Container `web`, nur HTTP) weiter. Ohne eigene Domain dient `<IP-mit-Bindestrichen>.sslip.io` als Hostname; das Zertifikat holt Host-Certbot (Webroot), die Erneuerung übernimmt dessen Systemd-Timer.
9. Erstinbetriebnahme: `docker compose up -d`, einmalig `docker compose run --rm api python -m app.seed` und Admin-User anlegen.
10. Backup: Host-Cron täglich `docker compose exec -T api sqlite3 /data/curlhard.db ".backup /backups/…"` (konsistent auch im laufenden Betrieb), `/backups` als Bind-Mount auf `/var/backups/curlhard` (dem Container-User gehörend), 14 Tage lokal, verschlüsselt mit `restic` auf eine Hetzner Storage Box (SFTP); Restore einmal pro Quartal testen.
11. Update-Skript `deploy.sh`: Backup ziehen, `docker compose pull`, `docker compose up -d` (Migration läuft beim Start von `api`), `docker image prune -f`. Rollback: vorheriges Tag in `CURLHARD_TAG` setzen und erneut `up -d`.
12. Monitoring: Compose-Healthcheck plus externer Uptime-Dienst auf `GET /api/health` (prüft DB-Zugriff); Logs über `docker compose logs`.

**`compose.yaml` (Auszug)**

```yaml
services:
  api:
    image: ghcr.io/<owner>/curlhard-api:${CURLHARD_TAG:-latest}
    env_file: .env
    read_only: true
    tmpfs: [/tmp]
    volumes:
      - data:/data
      - /var/backups/curlhard:/backups
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
      interval: 30s
    restart: unless-stopped
    logging: &log
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  web:
    image: ghcr.io/<owner>/curlhard-web:${CURLHARD_TAG:-latest}
    ports: ["127.0.0.1:8080:80"]   # TLS terminiert der Host-Nginx
    depends_on:
      api: { condition: service_healthy }
    restart: unless-stopped
    logging: *log

volumes:
  data:
```

## Umsetzungsphasen

Sechs Phasen, jede endet mit einem lauffähigen Stand auf dem Server; ab Phase 3 ist die App im Gym nutzbar.

1. **Fundament**
   - Monorepo, uv, Vite, Tailwind 3.4, shadcn/ui, Makefile, Dockerfiles, CI mit Image-Build
   - DB-Setup mit Pragmas, Alembic, alle Tabellen, Import des Übungskatalogs aus dem öffentlichen Datensatz
   - Auth (Registrierung mit Einladungscode, Login, Sessions), `current_user`, Isolationstest-Gerüst
   - Abnahme: Login auf dem iPhone 7 funktioniert, Isolationstest grün
2. **Stammdaten und Pläne**
   - Übungskatalog mit Suche und Filtern, Admin-Pflege, eigene private Übungen
   - Plan-Editor mit Trainingstagen, Wochentagen, Drag & Drop, Zielwerten
   - Abnahme: ein kompletter Wochenplan lässt sich auf dem Handy anlegen und umsortieren
3. **Workout-Logging**
   - Heute-Screen, Session starten, Sätze loggen mit vorbelegten Vorwerten, Stepper, Pausen-Timer mit Ton
   - Memos pro Session und dauerhaft, Session beenden, Verlauf und nachträgliche Korrektur
   - Abnahme: ein echtes Training wird vollständig auf dem iPhone geloggt, Timer läuft nach Bildschirm-Sperre korrekt weiter
4. **Statistik**
   - `stats.py` mit Unit-Tests (Volumen, e1RM, nRM, Bestwerte, Körpergewichtsübungen)
   - Übungsdetail mit Kennzahlen, e1RM- und Volumen-Graph, Rekordtabelle, Rekord-Badge im Workout, Wochenübersicht
   - Abnahme: Werte stimmen mit einer Excel-Gegenrechnung überein
5. **Produktivbetrieb**
   - Docker Compose auf Hetzner, Nginx-Container, TLS, Backup und Restore-Test, Deploy-Skript, Health-Check
   - Datenexport, Account-Löschung, Datenschutzseite, Security-Header, Rate-Limits
   - Abnahme: Restore aus Backup auf frischem Server klappt, alle Tests grün
6. **Feinschliff und PWA**
   - Installierbare PWA, Dark Mode, Animationen, Leerzustände, Onboarding mit Beispielplan
   - Optional: Offline-Logging mit Sync-Queue, Plan-Vorlagen, CSV-Export
   - Abnahme: Usability-Test mit 2–3 Personen, gefundene Probleme behoben

## Offene Entscheidungen

- [x] Registrierung: offen, mit Einladungscode oder nur durch Admin? Vorschlag: Einladungscode. Ja, Einladungscode
- [x] Dürfen User eigene Übungen anlegen, die nur sie sehen, oder ausschließlich Admin-Stammdaten? Vorschlag v1: nur Admin, User können Übungen vorschlagen. User können Übungen anlegen.
- [x] Erwartete Nutzerzahl (bestätigt die Wahl von SQLite bis etwa einige hundert User): 2 Benutzer
- [x] Domain und Server-Anbieter für TLS und Backup-Ziel: Hetzner
- [x] Startumfang des Übungskatalogs: eigene Liste oder ein öffentlicher Datensatz als Basis: öffentlicher Datensatz
- [x] Gewichtseinheit nur kg oder umschaltbar auf lbs: nur kg
