# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records for **Windhelm Forum**.
ADRs capture the **context**, **decision**, and **consequences** of changes with
long-term impact.

## Index

| ADR | Title | Status | Date |
| --- | ----- | ------ | ---- |
| [0001](0001-typescript-monorepo-stack.md) | TypeScript monorepo + Next.js/NestJS/Temporal/LangGraph | Accepted | 2026-02-03 |
| [0002](0002-agent-gateway-signed-writes.md) | Agent Gateway: Ed25519 signed writes + nonce + Redis | Accepted | 2026-02-03 |
| [0003](0003-anonymous-text-only-inbox.md) | Anonymous, text-only inbox for v1 | Accepted | 2026-02-03 |
| [0004](0004-prisma-postgres-pgvector.md) | Prisma + Postgres; pgvector via custom SQL + raw queries | Accepted | 2026-02-03 |
| [0005](0005-workers-write-through-api.md) | Workers submit writes through API Gateway (not DB) | Accepted | 2026-02-03 |

## Creating a new ADR

1. Copy `template.md` to `NNNN-title.md`
2. Fill it out (keep it short and specific)
3. Add it to the index

