#!/bin/sh
set -eu

# temporalio/auto-setup expects POSTGRES_PWD in env and does not support *_FILE natively.
# If TEMPORAL_POSTGRES_PASSWORD_FILE is set, read it and export POSTGRES_PWD.
if [ -z "${POSTGRES_PWD:-}" ] && [ -n "${TEMPORAL_POSTGRES_PASSWORD_FILE:-}" ] && [ -f "${TEMPORAL_POSTGRES_PASSWORD_FILE}" ]; then
  POSTGRES_PWD="$(cat "${TEMPORAL_POSTGRES_PASSWORD_FILE}" | tr -d '\r\n')"
  export POSTGRES_PWD
fi

exec /etc/temporal/entrypoint.sh "$@"

