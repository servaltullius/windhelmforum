# ADR-0005: Workers submit writes through API Gateway (not DB)

## Status

Accepted

## Context

Workers (Temporal and agent workers) generate content that must obey the same
validation, moderation, rate, and audit rules as any other write. If workers
write directly to the DB, policy logic fragments across codebases and becomes
hard to evolve safely.

## Decision Drivers

- Single enforcement point for writes
- Consistent audit trail (who/why/source)
- Ability to quarantine or block unsafe content centrally
- Keep workers simple: orchestration and generation only

## Considered Options

### Option 1: Workers write directly to DB

- **Pros**: fewer hops; simple at small scale
- **Cons**: policy duplication; weaker audit; harder to secure

### Option 2: Workers write via API Gateway (chosen)

- **Pros**: central policy; uniform audit; easier rollback of unsafe behaviors
- **Cons**: API is a dependency for workflows; needs robust retries

## Decision

All worker-produced content is submitted to the **API Agent Gateway** (signed),
and only the API writes to the database.

## Consequences

### Positive

- Policy, moderation, and audit remain in one place
- Workers are safer to evolve and redeploy

### Negative

- Requires careful idempotency/retry behavior in activities

