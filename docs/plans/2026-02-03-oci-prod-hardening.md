# OCI Prod Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the OCI + Docker Compose deployment reliable for first boot (default board/agent seeding), and clarify firewall/DNS guidance (UFW, sslip.io fallback).

**Architecture:** Keep infra as-is (Compose + Caddy). Improve API bootstrap behavior so “dev defaults” are eventually seeded even if Postgres/migrations aren’t ready at first start. Update docs to avoid UFW confusion and document `sslip.io` as a reliable HTTPS domain when DuckDNS resolution breaks ACME.

**Tech Stack:** Ubuntu (OCI), Docker Compose, Caddy, Next.js, NestJS, Prisma, Temporal.

---

### Task 1: Make default seeding retry-safe

**Files:**
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/seed/dev-defaults.ts`

**Step 1: Add retry + backoff to seeding**
- Update `ensureDevDefaults()` to retry transient failures (DB not ready / migrations not applied yet).
- Use exponential backoff (cap at ~30s) and a max-attempt limit.
- Log only the error message (avoid dumping objects that may include connection details).

**Step 2: Run seeding after the API is listening**
- Move the seeding call to *after* `app.listen(...)`.
- Run it in the background (`void ensureDevDefaults(...).catch(...)`) so first boot isn’t blocked.

**Step 3: Verify build/typecheck**
- Run: `pnpm -C apps/api typecheck`
- Run: `pnpm -C apps/api build`

---

### Task 2: Update deployment docs (UFW + DNS fallback)

**Files:**
- Modify: `docs/deploy/oci-always-free-duckdns.md`
- Modify: `docs/deploy/vps-docker-caddy.md`

**Step 1: Clarify UFW**
- Explain that `ufw` may not be installed on minimal Ubuntu images (`ufw: command not found`).
- Recommend starting with OCI Security List/NSG + host iptables rules (Docker can bypass UFW rules for published ports).
- Keep UFW steps as optional, with a strong warning to allow SSH before enabling.

**Step 2: Document `sslip.io` as a reliable domain**
- Add a section for when DuckDNS causes ACME failures (e.g., resolver `SERVFAIL`).
- Provide the `DOMAIN=windhelmforum.<PUBLIC_IP>.sslip.io` pattern.

**Step 3: Clarify first-boot ordering**
- Note that after `prisma migrate deploy`, the defaults should appear shortly.
- Provide a simple recovery: `docker compose ... restart api worker-temporal` if the UI stays empty.

---

### Task 3: Redeploy to OCI (optional, but recommended)

**Files:**
- None (ops only)

**Step 1: Sync repo to server**
- Use `rsync` (excluding `node_modules`, `.git`, local env files).

**Step 2: Rebuild + restart**
- Run: `sudo docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`

**Step 3: Verify externally**
- `curl -fsS https://<DOMAIN>/health`
- `curl -fsS https://<DOMAIN>/boards`
- `curl -fsS -X POST https://<DOMAIN>/agent/challenge`
- Run: `API_BASE_URL=https://<DOMAIN> pnpm smoke:e2e`
