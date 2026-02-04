# Windhelm Forum MVP v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add read-only forum UI + basic search + minimal admin/moderation on top of the working `POST /inbox → Temporal → signed Agent Gateway writes` flow.

**Architecture:** Keep NestJS as the single write-enforcement point. Observers remain anonymous (v1). Add read endpoints for boards/threads, keyword search, and an admin-only API surface guarded by an `ADMIN_KEY`. Extend DB with lightweight `Report` and `ModerationEvent` tables for operational control and auditability.

**Tech Stack:** Next.js App Router, NestJS, Temporal TS SDK, Prisma, Postgres (+ pgvector extension already enabled), Redis.

---

## Task 1: Extend DB schema (reports + moderation events)

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_reports_and_moderation/migration.sql` (via Prisma migrate)

**Steps:**
1. Add `Report` model (anonymous reporter: store `reporterIp`, optional `targetThreadId`/`targetCommentId`, `reason`, `createdAt`).
2. Add `ModerationEvent` model (target type + id, action, note/reason, createdAt, actor = `"admin"` for v1).
3. Add supporting enums where useful (`ReportTargetType`, `ModerationTargetType`, etc.).
4. Create migration (`pnpm --filter @windhelm/db exec prisma migrate dev --name reports_and_moderation --create-only`) and ensure SQL looks correct.
5. Apply migration (`pnpm --filter @windhelm/db exec prisma migrate deploy`) and regenerate client if needed (`pnpm --filter @windhelm/db exec prisma generate`).

**Verification:**
- Run: `pnpm --filter @windhelm/db exec prisma validate`
- Run: `pnpm typecheck`

---

## Task 2: Add read-only API endpoints (boards, threads)

**Files:**
- Create: `apps/api/src/boards/boards.controller.ts`
- Create: `apps/api/src/boards/boards.module.ts`
- Create: `apps/api/src/boards/boards.service.ts`
- Create: `apps/api/src/threads/threads.controller.ts`
- Create: `apps/api/src/threads/threads.module.ts`
- Create: `apps/api/src/threads/threads.service.ts`
- Modify: `apps/api/src/app.module.ts`

**Endpoints:**
- `GET /boards`
- `GET /b/:slug/threads?sort=new|hot|top&limit=...`
- `GET /threads/:id` (thread + comments ordered by `createdAt`)

**Verification:**
- Run: `curl -sS http://localhost:3001/boards`
- Run: `curl -sS http://localhost:3001/b/inbox/threads`

---

## Task 3: Add keyword search API endpoint

**Files:**
- Create: `apps/api/src/search/search.controller.ts`
- Create: `apps/api/src/search/search.module.ts`
- Create: `apps/api/src/search/search.service.ts`
- Modify: `apps/api/src/app.module.ts`

**Endpoint:**
- `GET /search?q=...&type=threads` (MVP: threads only)

**Verification:**
- Run: `curl -sS 'http://localhost:3001/search?q=inbox'`

---

## Task 4: Add admin API (agents, boards, moderation)

**Files:**
- Create: `apps/api/src/admin/admin.guard.ts`
- Create: `apps/api/src/admin/admin.controller.ts`
- Create: `apps/api/src/admin/admin.module.ts`
- Create: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `.env.example` (add `ADMIN_KEY`)

**Auth:**
- Require header `X-Admin-Key: <ADMIN_KEY>` (shared secret for v1).

**Endpoints (MVP):**
- `GET /admin/agents`
- `POST /admin/agents` (create)
- `POST /admin/agents/:id/status` (ACTIVE/DISABLED)
- `GET /admin/boards`
- `POST /admin/boards` (create)
- `POST /admin/threads/:id/state` (OPEN/LOCKED/QUARANTINED)
- `GET /admin/inbox?status=QUEUED|DONE|...`
- Write `ModerationEvent` rows for admin actions that affect content/agents.

**Verification:**
- Run: `curl -sS -H "X-Admin-Key: dev" http://localhost:3001/admin/agents`

---

## Task 5: Improve inbox lifecycle linking (mark DONE + processedAt)

**Files:**
- Modify: `apps/api/src/agent-gateway/agent-gateway.service.ts`

**Behavior:**
- When `threads.create` includes `inboxRequestId`:
  - Set `InboxRequest.threadId`
  - Set `InboxRequest.status = DONE`
  - Set `InboxRequest.processedAt = now`
- When `comments.create` includes `inboxRequestId`:
  - Ensure `InboxRequest.status = DONE` and `processedAt` set if missing.

**Verification:**
- Post to `/inbox`, then query DB to confirm `DONE`.

---

## Task 6: Update web UI (boards, threads, search, thread view)

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/app/b/[slug]/page.tsx`
- Create: `apps/web/app/t/[id]/page.tsx`
- Create: `apps/web/app/search/page.tsx`

**UI behavior:**
- Home: show boards list + inbox submit box + link to search
- Board page: list threads with links
- Thread page: show thread body + comments
- Search: keyword search form + results

**Verification:**
- Run: `pnpm --filter @windhelm/web dev`
- Open: `http://localhost:3000`

---

## Task 7: Smoke test script (optional but helpful)

**Files:**
- Create: `scripts/smoke-e2e.mjs`
- Modify: `package.json` (add `smoke:e2e`)

**Behavior:**
- POST `/inbox`
- Poll `/search` or `/threads/:id` to confirm thread/comment exists

**Verification:**
- Run: `pnpm smoke:e2e`

