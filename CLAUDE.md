# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Curlhard is a self-hosted workout tracker PWA: FastAPI + SQLModel/SQLite backend (`backend/`), Vite/React 19/TypeScript frontend (`frontend/`). Project language (UI strings, API error messages, docs, comments) is German. Concept and architecture: `Curlhard – Implementierungsplan.md`; setup/deploy details: `README.md`.

## Commands

Backend (Python 3.12, uv) — run from `backend/`:
- `uv sync && uv run alembic upgrade head`, then `uv run python -m app.seed` (idempotent catalog) and `uv run python -m app.create_admin EMAIL PASSWORT NAME`
- Lint/typecheck/tests: `uv run ruff check . && uv run mypy app && uv run pytest`
- Single test: `uv run pytest tests/test_plans.py::test_name -q`

Frontend — run from `frontend/`:
- `npm run dev` (Vite :5173, proxies `/api` → :8000), `npm run lint` (oxlint), `npm run typecheck`, `npm test` (Vitest; single file: `npx vitest run src/lib/weight.test.ts`)
- `npm run build && npm run check:compat` (verifies CSS output works on iOS 15 Safari)
- E2E: `npx playwright install chromium && npm run e2e` (starts backend + Vite itself via `e2e/start-backend.mjs`)

Root `Makefile`: `make dev` (backend with `COOKIE_SECURE=false` + Vite), `make migrate [MSG="..."]` (autogenerate + upgrade), `make lint`, `make test`, `make api-client`.

## Architecture

**API contract is generated.** FastAPI routes use `operation_id = function name` (`generate_unique_id_function`). `make api-client` exports `frontend/openapi.json` (`app.export_openapi`) and runs orval to produce `frontend/src/api/generated/`. Both files are committed and CI fails (`git diff --exit-code`) if they are stale — rerun `make api-client` after any router/schema change. Never hand-edit generated files. Requests go through `frontend/src/api/fetcher.ts` (cookie credentials, throws `ApiError` from the `{"error": {code, message, details}}` envelope).

**Backend layering** (`backend/app/`): `routers/` (all mounted under `/api/v1` in `main.py:create_app`) → `schemas/` (pydantic I/O) → `services/` (auth, invites, rate limiting, `stats.py` pure functions for e1RM/nRM) → `repositories/` + `models/` (SQLModel). `create_app(settings)` is a factory; engine, settings and rate limiter live on `app.state`. Auth is a session cookie resolved in `deps.current_user`; `require_admin` guards admin routes. A middleware rejects cross-origin write requests unless the origin is in `ALLOWED_ORIGINS`.

**Multi-user isolation is a core invariant.** Every user-owned query must filter by `user_id` — use `repositories.common.get_owned` / `get_visible_exercise`; foreign resources must return 404 (not 403), unauthenticated 401. Exercises are global (`owner_user_id IS NULL`) or private to a user. `tests/test_isolation.py` exercises every endpoint with two users — extend it when adding endpoints.

**Tests** use in-memory SQLite via the `app`/`admin`/client fixtures in `backend/tests/conftest.py` (schema created with `create_all`, not Alembic). Schema changes still need an Alembic migration in `backend/migrations`.

**Frontend** (`frontend/src/`): TanStack Router (`router.tsx`, pages in `routes/`), TanStack Query for server state, Zustand stores in `stores/` (active workout session and settings persist client-side), react-hook-form + zod (`lib/schemas.ts`), Tailwind + shadcn-style primitives in `components/ui/`. Target browser floor is iOS 15 Safari — `check:compat` fails the build on unsupported CSS.

**Deployment**: Docker Compose in `deploy/` (api + nginx frontend + certbot), images built by CI to GHCR on pushes to `main`. `backend/entrypoint.sh` runs migrations on container start.
