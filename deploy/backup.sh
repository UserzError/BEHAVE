#!/bin/sh
# Nightly database backup: a compressed dump of the behave database, keeping the last 14 days.
# Runs as the behave user from /etc/cron.d/behave-backup (see DEPLOY.md). Restore one with:
#   sudo -u behave pg_restore --clean --if-exists -d behave /var/backups/behave/behave-YYYY-MM-DD.dump
set -eu
DIR=/var/backups/behave
pg_dump --format=custom --file="$DIR/behave-$(date +%F).dump.partial" behave
mv "$DIR/behave-$(date +%F).dump.partial" "$DIR/behave-$(date +%F).dump"  # only complete dumps get the real name
find "$DIR" -name 'behave-*.dump' -mtime +14 -delete
