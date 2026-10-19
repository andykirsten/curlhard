#!/bin/sh
# Einmaliger Umstieg SQLite -> Postgres auf dem Server.
# Voraussetzung: neue compose.yaml + .env (mit POSTGRES_PASSWORD) liegen hier, der alte Stack läuft noch.
# Die SQLite-Daten werden nur gelesen; Volume deploy_data bleibt als Rollback unverändert bestehen.
set -eu

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/curlhard}"
STAMP="$(date +%Y%m%d-%H%M%S)"

rollback_hint() {
    echo "FEHLER beim Umstieg. Rollback: alte compose.yaml/.env wiederherstellen, CURLHARD_TAG auf" >&2
    echo "das vorherige Image setzen und 'docker compose up -d'. Die SQLite-Daten (Volume deploy_data" >&2
    echo "und ${BACKUP_DIR}/vor-postgres-${STAMP}.db) sind unverändert." >&2
}
trap 'rc=$?; [ "$rc" -eq 0 ] || rollback_hint' EXIT

# 1. Neue Images holen, solange der alte Stack noch läuft (kein Ausfall bei Pull-Fehlern)
docker compose pull

# 2. Konsistente Sicherung der laufenden SQLite-Datenbank (alter api-Container mit sqlite3)
docker compose exec -T api sqlite3 /data/curlhard.db ".backup /backups/vor-postgres-${STAMP}.db"
test -s "${BACKUP_DIR}/vor-postgres-${STAMP}.db"

# 3. Schreibzugriffe beenden, damit zwischen Sicherung und Import nichts verloren geht
docker compose stop web api

# 4. Postgres starten, Schema anlegen
docker compose up -d --wait db
docker compose run --rm --no-deps --entrypoint alembic api upgrade head

# 5. Import: SQLite-Dateien (inkl. -wal/-shm) nach /tmp kopieren, damit SQLite sie sauber öffnet
docker compose run --rm --no-deps -v deploy_data:/olddata:ro --entrypoint sh api -c \
    'mkdir /tmp/old && cp /olddata/curlhard.db* /tmp/old/ && python -m app.sqlite_to_postgres /tmp/old/curlhard.db'

# 6. Neuen Stack starten und Sicherung im neuen Format ziehen
docker compose up -d
./backup.sh

echo "Umstieg abgeschlossen. Login prüfen; deploy_data erst nach einigen Wochen entfernen."
