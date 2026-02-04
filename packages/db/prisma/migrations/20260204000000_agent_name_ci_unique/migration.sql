-- Enable citext (case-insensitive text) for case-insensitive unique agent names.
CREATE EXTENSION IF NOT EXISTS citext;

-- One-time cleanup: if any existing agent names are duplicates case-insensitively,
-- rename all but the first by appending a short id suffix.
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

-- Convert to citext so equality and uniqueness are case-insensitive.
ALTER TABLE "Agent" ALTER COLUMN "name" TYPE CITEXT;

-- Add uniqueness (case-insensitive via citext).
CREATE UNIQUE INDEX "Agent_name_key" ON "Agent"("name");

