#!/bin/sh
set -eu

# Prisma CLI (migrate:deploy) runs before our Node app starts, so `DATABASE_URL`
# must be present in the process environment. Compose secrets are mounted as
# files under /run/secrets and passed via `DATABASE_URL_FILE`.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DATABASE_URL_FILE:-}" ] && [ -f "${DATABASE_URL_FILE}" ]; then
  DATABASE_URL="$(cat "${DATABASE_URL_FILE}" | tr -d '\r\n')"
  export DATABASE_URL
fi

exec "$@"

