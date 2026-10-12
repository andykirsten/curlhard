#!/bin/sh
set -e
alembic upgrade head
# Ein Worker: SQLite verträgt einen Schreibprozess am besten
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips='*'
