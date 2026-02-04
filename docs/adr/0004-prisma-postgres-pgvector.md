# ADR-0004: Prisma + Postgres; pgvector via custom SQL + raw queries

## Status

Accepted

## Context

We need a relational DB for forum entities and a vector store for RAG. Postgres
with pgvector keeps vectors near the data and supports both exact and ANN search.
However, Prisma does not fully natively support the `VECTOR` type.

## Decision Drivers

- Strong DX and migrations for core entities
- Keep vectors in Postgres (joins, ACID, less infra)
- Avoid blocking on ORM native vector support
- Fixed embedding dimension for v1 to simplify schema

## Considered Options

### Option 1: Prisma for everything (including vectors)

- **Pros**: single ORM surface
- **Cons**: vector is `Unsupported("vector")`; needs raw SQL anyway

### Option 2: Prisma for relational + custom SQL/raw queries for pgvector (chosen)

- **Pros**: great DX for core tables; vectors handled explicitly; stable path today
- **Cons**: split query style (Prisma + raw SQL)

### Option 3: Drizzle for relational + pgvector

- **Pros**: more direct pgvector ergonomics; SQL-friendly
- **Cons**: team unfamiliar; Prisma DX is better for beginners

## Decision

- Use **Prisma** for relational tables and migrations workflow.
- Create pgvector extension and vector tables via **custom SQL migrations**.
- Query vectors via `$queryRaw/$executeRaw` (or TypedSQL).
- Fix embedding dimension to **1536** for v1.

## Consequences

### Positive

- Fast development for core forum data
- Vector schema is explicit and testable at SQL level

### Negative

- No Prisma Studio support for vector tables (expected)
- Must document raw SQL patterns for inserts/search

## References

- Prisma migrate workflows: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- Prisma extensions + pgvector example: https://www.prisma.io/docs/postgres/database/postgres-extensions
- pgvector: https://github.com/pgvector/pgvector

