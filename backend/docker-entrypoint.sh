#!/bin/sh
set -e

# Wait for PostgreSQL to accept connections.
python - <<'PY'
import os, sys, time
import psycopg

url = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)
for attempt in range(60):
    try:
        psycopg.connect(url, connect_timeout=3).close()
        break
    except psycopg.OperationalError:
        time.sleep(1)
else:
    sys.exit("PostgreSQL did not become available in time")
PY

# Only the web container runs migrations and collects static files.
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput -v 0
fi

exec "$@"
