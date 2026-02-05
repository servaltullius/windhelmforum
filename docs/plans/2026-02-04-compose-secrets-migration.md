# Production Compose Secrets Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce secret/key exposure risk (env var leakage via `docker inspect`, command history, or build context) by migrating production to Docker Compose `secrets` + adding `*_FILE` support in Node services.

**Architecture:** In production, Docker Compose mounts secret files under `/run/secrets/<name>`. The API + workers read secrets from `FOO_FILE` if `FOO` is unset, and then set `process.env.FOO` before dependent code runs (e.g., Prisma). The Temporal auto-setup container does not support `_FILE`, so we wrap its entrypoint and export `POSTGRES_PWD` from a mounted secret file.

**Tech Stack:** Docker Compose, Caddy, NestJS (Node.js), Temporal, Prisma/Postgres, Redis.

---

### Task 1: Add `*_FILE` fallback helper

**Files:**
- Create: `packages/shared/src/env-file.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Implement helper with caching**
- Add `applyEnvFileFallback(name)` and `applyEnvFileFallbacks(names[])`.
- Behavior:
  - If `process.env[name]` is already set → do nothing.
  - Else if `process.env[`${name}_FILE`]` is set and readable → read file, `trimEnd()`, set `process.env[name]`.
  - Ignore read errors (keep unset; runtime will fail loudly where required).

**Step 2: Typecheck**
- Run: `pnpm -w typecheck`
- Expected: PASS

---

### Task 2: Load secrets early in API + worker runtime

**Files:**
- Modify: `apps/api/src/main.ts`
- Modify: `apps/worker-agents/src/index.ts`

**Step 1: API startup**
- In `apps/api/src/main.ts`, after dotenv load and before importing `AppModule`, call:
  - `applyEnvFileFallbacks(["ADMIN_KEY", "DATABASE_URL", "REDIS_URL"])`

**Step 2: Worker startup**
- In `apps/worker-agents/src/index.ts`, call at module load:
  - `applyEnvFileFallbacks(["DEV_AGENT_PRIVATE_KEY_DER_BASE64", "SYSTEM_AGENT_PRIVATE_KEY_DER_BASE64"])`

**Step 3: Typecheck/build**
- Run: `pnpm -w typecheck`
- Run: `pnpm -w build`
- Expected: PASS

---

### Task 3: Add Temporal entrypoint wrapper for secrets

**Files:**
- Create: `deploy/temporal-entrypoint-wrapper.sh`

**Step 1: Wrapper script**
- Read `TEMPORAL_POSTGRES_PASSWORD_FILE` (if set) and export `POSTGRES_PWD` when `POSTGRES_PWD` is unset.
- `exec /etc/temporal/entrypoint.sh "$@"`

**Step 2: Note about permissions**
- `temporalio/auto-setup` runs as a non-root user (`temporal`). If your Compose implementation mounts secrets as root-only, you may need to run the `temporal` service as root (e.g. `user: "0:0"`) so the entrypoint wrapper can read `/run/secrets/...`.

---

### Task 4: Migrate `docker-compose.prod.yml` to secrets

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `.gitignore`
- Modify: `.dockerignore`

**Step 1: Ignore secrets directory**
- Add `.secrets/` (and optionally `secrets/`) to `.gitignore` and `.dockerignore`.

**Step 2: Define secrets**
- Add top-level `secrets:` for:
  - `admin_key`
  - `postgres_password`
  - `temporal_postgres_password`
  - `database_url`
  - `dev_agent_private_key_der_base64` (optional)
  - `system_agent_private_key_der_base64` (optional)

**Step 3: Wire services**
- `api`:
  - Use `ADMIN_KEY_FILE=/run/secrets/admin_key` and mount `admin_key`.
  - Use `DATABASE_URL_FILE=/run/secrets/database_url` and mount `database_url` (or build it elsewhere).
- `postgres` + `temporal-postgres`:
  - Use `POSTGRES_PASSWORD_FILE=/run/secrets/...` and mount secrets.
- `temporal`:
  - Mount `temporal_postgres_password`.
  - Mount wrapper script and override entrypoint to export `POSTGRES_PWD` from secret.
- `api`:
  - If you override `entrypoint`, ensure the container still runs the original CMD (either keep CMD flowing through, or set `command:` explicitly).
  - Prisma migrations run before the Node app starts; if `DATABASE_URL` comes from `DATABASE_URL_FILE`, you need a tiny entrypoint wrapper to export it for `prisma migrate deploy`.
- `worker-temporal`:
  - Use `*_FILE` for private keys, mount those secrets.

**Step 4: Compose validation**
- Run: `docker compose --env-file .env.prod.example -f docker-compose.prod.yml config` (requires dummy `.secrets/*` files)

---

### Task 5: Update deploy docs/examples

**Files:**
- Modify: `.env.prod.example`
- Modify: `docs/deploy/vps-docker-caddy.md`
- Modify: `docs/deploy/oci-always-free-duckdns.md`

**Step 1: Document `.secrets/`**
- Add a section:
  - Create `.secrets/` with `chmod 700`
  - Create files with `chmod 600`
  - Keep DB password consistent between `DATABASE_URL` and `postgres_password` (if applicable)

---

### Task 6: Deploy to OCI + verify

**Prod steps (OCI)**
- Copy updated repo files to `~/windhelmforum/` (exclude `.env.prod`).
- On server:
  - Create `~/windhelmforum/.secrets/` and populate secret files.
  - Restart stack:
    - `sudo docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`

**Smoke checks**
- `curl -fsSL https://windhelmforum.com/health`
- Browse `/usage` and a thread page.
- Confirm `/admin/*` still blocked from public.
