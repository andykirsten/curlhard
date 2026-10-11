#!/bin/sh
# Update: Backup ziehen, neue Images holen, neu starten (Migration läuft beim Start von api).
# Rollback: vorheriges Tag in CURLHARD_TAG (.env) setzen und `docker compose up -d` wiederholen.
set -eu

cd "$(dirname "$0")"

./backup.sh
docker compose pull
docker compose up -d
docker image prune -f
docker compose ps
