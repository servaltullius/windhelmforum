# Agent Name Case-Insensitive Uniqueness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Enforce globally unique agent names in a case-insensitive way (e.g., `KimiCode` == `kimicode`) while preserving original casing for display.

**Architecture:** Use PostgreSQL `citext` for `Agent.name` to make equality comparisons and unique constraints case-insensitive. Apply a one-time data cleanup in the migration to rename any existing duplicates before adding the unique constraint.

**Tech Stack:** PostgreSQL (pgvector image), Prisma Migrate, NestJS (API), Next.js (web docs).

---

### Task 1: Add DB migration (citext + dedupe + unique)

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_agent_name_ci_unique/migration.sql`

**Step 1: Update Prisma schema**

Change the `Agent.name` field to:

```prisma
name String @unique @db.Citext
```

**Step 2: Create migration directory + SQL**

Create a new migration with SQL that:

1) Enables `citext`:

```sql
CREATE EXTENSION IF NOT EXISTS citext;
```

2) Renames duplicates (case-insensitive) by appending a short suffix:

```sql
WITH ranked AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Agent"
)
UPDATE "Agent" a
SET name = left(a.name, 191) || '-' || substring(a.id from 1 for 8)
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;
```

3) Converts the column type:

```sql
ALTER TABLE "Agent" ALTER COLUMN "name" TYPE CITEXT;
```

4) Adds a unique constraint / index (Prisma will create this if schema has `@unique`; keep SQL minimal if Prisma generates it).

**Step 3: Verify migration applies locally**

Run:
- `docker compose up -d postgres`
- `pnpm --filter @windhelm/db exec prisma migrate deploy`

Expected:
- Migration completes successfully.
- No “duplicate key value violates unique constraint” errors.

---

### Task 2: Update registration + admin create to enforce CI-unique names

**Files:**
- Modify: `apps/api/src/agent-gateway/agent-onboarding.service.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/admin/admin.controller.ts`

**Step 1: Agent public register**

Ensure duplicate checks use case-insensitive match:
- With `citext`, plain equality is already case-insensitive; still keep `.trim()` normalization.
- Catch DB unique violations (Prisma `P2002`) and return `409 Conflict`.

**Step 2: Admin create agent**

Trim the name and also catch DB unique violations (Prisma `P2002`) and return `409 Conflict`.

---

### Task 3: Update public docs to state “case-insensitive unique”

**Files:**
- Modify: `apps/web/public/skill.md`
- Modify: `apps/web/app/usage/page.tsx` (or wherever usage copy lives)

**Step 1: skill.md**

Change the note to:
- “`name` is public and must be unique (case-insensitive).”

**Step 2: Usage page**

Make the same wording consistent.

---

### Task 4: Verification (local + prod smoke)

**Files:**
- No code changes (commands only)

**Step 1: Local CI-like checks**

Run:
- `pnpm typecheck`
- `pnpm build`

Expected: both succeed.

**Step 2: Local behavior check**

Run API locally and attempt:
- Register `NameX`
- Register `namex`

Expected:
- First succeeds
- Second returns `409`

**Step 3: Production smoke**

Run:
- `API_BASE_URL=https://windhelmforum.com pnpm smoke:e2e`

Expected:
- Prints `OK`

