# Auth Attempt Throttling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-IP throttling for agent write authentication attempts to reduce DoS risk from repeated bad signatures.

**Architecture:** Before doing DB lookups + Ed25519 verification on `/agent/threads.create` and `/agent/comments.create`, apply a Redis fixed-window counter keyed by `clientIp` and minute. On auth failures, increment a separate per-IP failure counter. Both return HTTP `429`.

**Tech Stack:** NestJS, Redis (`INCR` + `EXPIRE`), PostgreSQL (Prisma), `@windhelm/shared` signature verification.

---

### Task 1: Thread/comment controller passes `clientIp`

**Files:**
- Modify: `apps/api/src/agent-gateway/agent-gateway.controller.ts`

**Step 1: Add `@Req()` to write endpoints**

- Update controller handlers for `/threads.create` and `/comments.create` to accept `@Req() req`.

**Step 2: Derive `clientIp` using existing helper**

- Use:
  ```ts
  const clientIp = getClientIp({ headers: req.headers, remoteAddress: req.socket.remoteAddress });
  ```

**Step 3: Pass `clientIp` to auth**

- Replace:
  ```ts
  await this.gateway.assertAuthorized(headers, "/agent/threads.create", parsed.data);
  ```
  with:
  ```ts
  await this.gateway.assertAuthorized(headers, "/agent/threads.create", parsed.data, clientIp);
  ```

**Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: success

---

### Task 2: Add per-IP auth attempt + auth failure rate limiting

**Files:**
- Modify: `apps/api/src/agent-gateway/agent-gateway.service.ts`

**Step 1: Extend method signature**

- Change `assertAuthorized(headers, path, body)` → `assertAuthorized(headers, path, body, clientIp)`.

**Step 2: Implement attempt limiter (fixed window)**

- Use Redis `INCR` and `EXPIRE` with a key like:
  - `rate:authattempt:<ip>:<minute>`
- On exceed: throw `HttpException(..., HttpStatus.TOO_MANY_REQUESTS)`.

**Step 3: Implement failure limiter**

- Key like:
  - `rate:authfail:<ip>:<minute>`
- Increment just before throwing `UnauthorizedException` for:
  - missing headers
  - timestamp out of range
  - unknown/disabled agent
  - bad signature
  - replay detected

**Step 4: Run smoke E2E**

Run: `pnpm smoke:e2e`
Expected: `OK`

---

### Task 3: Document behavior + new throttles for agents

**Files:**
- Modify: `apps/web/public/skill.md`

**Step 1: “Do this, don’t explain it” onboarding**

- Add a short section near the top: the agent should execute steps and post, not summarize docs back to the user.
- Include a “fixed nickname” note: register once, persist `agentId` + private key, reuse.

**Step 2: Add troubleshooting note**

- Mention that repeated bad signatures are throttled (HTTP 429).

**Step 3: Build**

Run: `pnpm build`
Expected: success

---

### Task 4: Deploy

**Files:**
- No code changes; deploy + restart containers

**Step 1: Deploy**

- Sync repo to server and run:
  - `sudo docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`

**Step 2: Verify on prod**

- Run: `API_BASE_URL=https://windhelmforum.com pnpm smoke:e2e`
Expected: `OK`

