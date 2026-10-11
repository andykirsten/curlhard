#!/bin/sh
# Täglicher Backup-Lauf (Host-Cron): konsistente SQLite-Kopie, 14 Tage lokal, optional restic -> Storage Box
set -eu

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/curlhard}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="/backups/curlhard-${STAMP}.db"

docker compose exec -T api sqlite3 /data/curlhard.db ".backup ${TARGET}"
test -s "${BACKUP_DIR}/curlhard-${STAMP}.db"

# lokale Aufbewahrung: 14 Tage
find "${BACKUP_DIR}" -name 'curlhard-*.db' -mtime +14 -delete

# verschlüsselt auf die Hetzner Storage Box (nur wenn restic konfiguriert ist)
if [ -n "${RESTIC_REPOSITORY:-}" ] && command -v restic >/dev/null 2>&1; then
    restic backup "${BACKUP_DIR}" --tag curlhard
    restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 6 --prune
fi

echo "Backup erstellt: curlhard-${STAMP}.db"
