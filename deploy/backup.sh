#!/bin/sh
# Täglicher Backup-Lauf (Host-Cron): pg_dump (custom format), 14 Tage lokal, optional restic -> Storage Box
set -eu

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/curlhard}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/curlhard-${STAMP}.dump"

mkdir -p "${BACKUP_DIR}"
# Bei Fehlern keine halbe Datei zurücklassen
docker compose exec -T db pg_dump -U curlhard -Fc curlhard > "${TARGET}.tmp" || { rm -f "${TARGET}.tmp"; exit 1; }
test -s "${TARGET}.tmp"
mv "${TARGET}.tmp" "${TARGET}"

# lokale Aufbewahrung: 14 Tage
find "${BACKUP_DIR}" -name 'curlhard-*.dump' -mtime +14 -delete

# verschlüsselt auf die Hetzner Storage Box (nur wenn restic konfiguriert ist)
if [ -n "${RESTIC_REPOSITORY:-}" ] && command -v restic >/dev/null 2>&1; then
    restic backup "${BACKUP_DIR}" --tag curlhard
    restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 6 --prune
fi

echo "Backup erstellt: curlhard-${STAMP}.dump"
