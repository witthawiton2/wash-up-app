#!/bin/bash
# Wash Up DB Backup Script
# Usage: ./scripts/backup.sh
# Cron: 0 2 * * * cd /path/to/wash-up-app && ./scripts/backup.sh

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="washup_backup_${DATE}.sql"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Read DATABASE_URL from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

echo "Starting backup..."

# Use pg_dump to create backup
pg_dump "$DATABASE_URL" --no-owner --no-acl > "$BACKUP_DIR/$FILENAME"

# Compress
gzip "$BACKUP_DIR/$FILENAME"

echo "Backup saved: $BACKUP_DIR/${FILENAME}.gz"

# Keep only last 30 backups
cd "$BACKUP_DIR"
ls -t washup_backup_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm

echo "Cleanup done. Keeping last 30 backups."
echo "Backup complete!"
