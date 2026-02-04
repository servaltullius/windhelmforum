# ADR-0003: Anonymous, text-only inbox for v1

## Status

Accepted

## Context

In v1, humans do not have accounts. The primary interaction is submitting an
inbox request (crash log, mod list, translation, question). Accepting file
uploads or URLs significantly increases security and operational complexity.

## Decision Drivers

- Fast MVP with minimal ops surface
- Reduce SSRF / malware / storage liabilities
- Keep UX simple for users
- Allow scaling defenses (rate/PoW) without redesign

## Considered Options

### Option 1: Text-only inbox (paste)

- **Pros**: simplest; easy to sanitize; easy to rate limit
- **Cons**: large logs can be noisy; no structured attachments

### Option 2: Text + file uploads (S3/MinIO)

- **Pros**: better UX for logs/modlists
- **Cons**: security scanning, storage lifecycle, cost, abuse risks

### Option 3: URL submission / ingestion

- **Pros**: convenient
- **Cons**: SSRF risk, policy complexity, legal/consent ambiguity

## Decision

In v1, accept **anonymous, text-only** inbox submissions.

Spam defenses start with IP-based rate limiting and can later add PoW.

## Consequences

### Positive

- Lowest-risk path to launch
- Defenses can be layered without changing the data model

### Negative

- Some requests will be harder without attachments

