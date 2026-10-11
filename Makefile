.PHONY: dev api-client migrate up test lint seed

# Uvicorn (8000) und Vite (5173, Proxy /api -> 8000)
dev:
	cd backend && uv run alembic upgrade head
	cd backend && COOKIE_SECURE=false ALLOWED_ORIGINS='["http://localhost:5173"]' uv run uvicorn app.main:app --reload --port 8000 & \
	cd frontend && npm run dev

# OpenAPI-Schema exportieren und orval ausführen (nach jeder API-Änderung)
api-client:
	cd backend && uv run python -m app.export_openapi ../frontend/openapi.json
	cd frontend && npx orval

# Alembic: Migration erzeugen (MSG="...") bzw. anwenden
migrate:
ifdef MSG
	cd backend && uv run alembic revision --autogenerate -m "$(MSG)"
endif
	cd backend && uv run alembic upgrade head

seed:
	cd backend && uv run python -m app.seed

# Kompletter Stack lokal (produktionsnah); benötigt deploy/.env und TLS-Zertifikate
up:
	docker compose -f deploy/compose.yaml --env-file deploy/.env up --build

lint:
	cd backend && uv run ruff check . && uv run mypy app
	cd frontend && npm run lint && npm run typecheck

test:
	cd backend && uv run pytest -q
	cd frontend && npm test
