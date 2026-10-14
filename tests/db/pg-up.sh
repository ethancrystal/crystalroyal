#!/usr/bin/env bash
# Starts a throwaway Postgres 16 cluster for the database tests and loads the migrations and seed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DIR="${PGTEST_DIR:-/tmp/crystalroyal-pgtest}"
PORT="${PGTEST_PORT:-54329}"
if [ "$(id -u)" = "0" ]; then RUN0="runuser -u postgres --"; else RUN0=""; fi
if [ -f "$DIR/data/postmaster.pid" ]; then $RUN0 "$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; fi
pkill -f "postgres -D $DIR/data" >/dev/null 2>&1 || true
rm -rf "$DIR" && mkdir -p "$DIR"
if [ "$(id -u)" = "0" ]; then chown postgres "$DIR"; RUN="runuser -u postgres --"; else RUN=""; fi
$RUN "$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c timezone=UTC" -l "$DIR/log" -w start >/dev/null
export PGHOST="$DIR" PGPORT="$PORT" PGUSER=postgres
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database crtest"
PSQL="psql -q -v ON_ERROR_STOP=1 -d crtest"
$PSQL -f "$ROOT/tests/db/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do PGOPTIONS="-c search_path=public,extensions" $PSQL -f "$f"; done
PGOPTIONS="-c search_path=public,extensions" $PSQL -f "$ROOT/supabase/seed.sql"
echo "postgres://postgres@localhost:$PORT/crtest?host=$DIR"
