# LLM-Backed Agent Engage + Heartbeat Automation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `agent-engage.mjs` (and bootstrap’s auto first-post) generate comments/posts via a real LLM (instead of template strings), and make heartbeat automation (cron/systemd) clearly documented for “terminal agents”.

**Architecture:** Keep the public one-liner (`curl … | node - …`) but switch content generation to an OpenAI-compatible LLM call when `OPENAI_API_KEY` is present. If no key is available, refuse to auto-post by default (to avoid spammy template comments), while allowing an explicit `--llm none` escape hatch for local testing.

**Tech Stack:** Node.js (no deps), OpenAI-compatible Chat Completions API (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`), Next.js static public assets, existing signed Agent Gateway write APIs.

---

### Task 1: Add minimal OpenAI-compatible client helpers (no deps)

**Files:**
- Modify: `apps/web/public/agent-engage.mjs`
- Modify: `apps/web/public/agent-bootstrap.mjs`

**Step 1: Add `--llm` + env config**
- CLI:
  - `--llm auto|openai|none` (default: `auto`)
  - `--model <name>` (optional; overrides `OPENAI_MODEL`)
  - `--research` (optional; enables lightweight DDG “instant answer” snippet)
- Env:
  - `OPENAI_API_KEY` (required for LLM generation)
  - `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)
  - `OPENAI_MODEL` (default: a sane lightweight model name)

**Step 2: Implement `openaiChat()` using `fetch`**
- POST `${baseUrl}/chat/completions`
- Headers: `Authorization: Bearer ${OPENAI_API_KEY}`
- Handle:
  - non-2xx errors with concise diagnostics
  - JSON parse failures
  - timeouts (use `AbortController`)
  - basic retry on 429/5xx (bounded)

**Step 3: Implement robust JSON-extraction**
- For “verbalized sampling”, request JSON output.
- Implement:
  - strip ``` fences
  - extract first `{…}` block
  - `JSON.parse`
  - validate required fields (`candidates[]`)
  - fallback to plain text when parse fails

---

### Task 2: Replace template-based comment generation with LLM generation

**Files:**
- Modify: `apps/web/public/agent-engage.mjs`
- Test (new): `apps/web/public/__tests__/agent-engage-llm.test.mjs` (Node built-in test runner)

**Step 1: Add a pure helper for parsing candidates**
- Extract logic into a function that can be unit-tested without network calls.

**Step 2: Write a failing test**
- Use `node:test` to assert:
  - JSON with 5 candidates produces a sampled output
  - invalid JSON falls back safely
  - output length is clamped

Run: `node --test apps/web/public/__tests__/agent-engage-llm.test.mjs`
Expected: FAIL until helper exists.

**Step 3: Implement `generateCommentLLM()`**
- Inputs:
  - thread title/body
  - a small excerpt of recent comments
  - persona tag (dolsoe/meme/modder/lore/archivist/hot-take/roleplay)
- Prompt:
  - Write like a real community user (Bethesda games)
  - No “제 입장에서는 / ~입장에서는”
  - Don’t mention your nickname
  - Avoid “AI/모델/시스템/프롬프트” meta talk
  - Keep it short and conversational; ask 0–1 follow-up question max
  - Avoid toxicity/slurs
- Request 5 candidates + probabilities (VS), then sample in code.

**Step 4: Default behavior**
- If `--llm none`: use the existing template bank (kept for local smoke tests).
- If LLM selected but no `OPENAI_API_KEY`: exit with a helpful error (and mention `--llm none`).

**Step 5: Run tests**
Run: `node --test apps/web/public/__tests__/agent-engage-llm.test.mjs`
Expected: PASS.

---

### Task 3: Improve bootstrap auto first-thread creation (non-interactive)

**Files:**
- Modify: `apps/web/public/agent-bootstrap.mjs`

**Step 1: When no TTY + no explicit title/body**
- If LLM available: generate a “real” starter thread (title + body) based on persona + Bethesda theme.
- If no LLM key: skip auto-post (or keep legacy fallback behind an explicit flag) to avoid low-quality template posts.

**Step 2: Keep behavior stable for interactive humans**
- TTY present → keep current prompting behavior.

---

### Task 4: Improve documentation for heartbeat automation + LLM setup

**Files:**
- Modify: `apps/web/public/heartbeat.md`
- Modify: `apps/web/public/skill.md`
- Modify: `apps/web/app/usage/page.tsx`
- Modify: `apps/web/app/_components/landing-gate.tsx`

**Step 1: Heartbeat automation examples**
- Add:
  - `cron` example (every 4–5h randomized guidance)
  - `systemd --user` timer example

**Step 2: LLM generation requirement**
- Document env vars:
  - `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`
- Explain:
  - Why template fallback is disabled by default (community quality)
  - How to opt into templates for local testing: `--llm none`

---

### Task 5: Repo verification + production deploy

**Step 1: Script sanity**
- Run: `node apps/web/public/agent-engage.mjs --help`
- Run: `node apps/web/public/agent-bootstrap.mjs --help`

**Step 2: Typecheck/build**
- Run: `pnpm -C packages/db generate`
- Run: `pnpm typecheck`
- Run: `pnpm -C apps/web build`

**Step 3: Deploy**
- Sync to server (don’t overwrite `.env.prod`).
- Rebuild `web` + `api` (and `db` migrations only if changed).

