---
layout: post
title: "Zero-Downtime Deployments: A Practical Checklist"
date: 2025-02-10
description: "Blue-green, canary, rolling &mdash; and which one to actually use. Includes database migration patterns that won't lock your tables at peak traffic."
category: "Cloud & DevOps"
tags: [Cloud & DevOps, Databases]
read_time: "9 min read"
featured: false
---

Zero-downtime deployment is not a deployment strategy &mdash; it is a combination of application design, database practices, and infrastructure patterns working together. Most teams get the infrastructure part right and then discover the database is the bottleneck at 2 AM.

## The Three Deployment Strategies

### Rolling Deployment

Replace instances one at a time. At any moment, old and new code run in parallel.

**Requirement:** Both old and new code must be able to read and write the same database schema simultaneously. If v2 adds a column that v1 does not know about, and both write to the same row, you may produce inconsistent data.

**Best for:** Stateless services with backward-compatible changes.

### Blue-Green Deployment

Maintain two identical environments. Route traffic to one (blue), deploy to the other (green), then switch the load balancer.

```
            ┌─────────┐
Traffic ───▶│  Blue   │  (live)
            └─────────┘

Deploy to:
            ┌─────────┐
            │  Green  │  (staging → next live)
            └─────────┘
```

**Requirement:** Both environments must point to the same database (or you accept a brief cutover window for data migration).

**Best for:** Infrequent but high-risk releases, easy rollback requirement.

### Canary Deployment

Route a small percentage of traffic (1–5%) to the new version. Monitor error rates and latency. Gradually increase to 100%.

**Best for:** High-confidence progressive releases. Requires observability tooling to make decisions.

## The Database Migration Problem

This is where most zero-downtime deployments fail. A migration that adds `ALTER TABLE orders ADD COLUMN discount_pct DECIMAL` will acquire an `ACCESS EXCLUSIVE` lock on large tables &mdash; blocking every read and write for the duration.

### The Expand-Contract Pattern

Break every breaking schema change into phases:

**Phase 1 &mdash; Expand (deploy with old code):**
```sql
-- Add the new column, nullable, with no constraints
ALTER TABLE orders ADD COLUMN discount_pct DECIMAL;
```

**Phase 2 &mdash; Migrate (background job):**
```sql
-- Backfill in batches to avoid lock contention
UPDATE orders
SET discount_pct = 0
WHERE id BETWEEN :start AND :end
  AND discount_pct IS NULL;
```

**Phase 3 &mdash; Constraint (deploy with new code reading new column):**
```sql
-- Add NOT NULL constraint only after backfill is complete
ALTER TABLE orders
  ALTER COLUMN discount_pct SET NOT NULL,
  ALTER COLUMN discount_pct SET DEFAULT 0;
```

**Phase 4 &mdash; Contract (later release, remove old column if applicable).**

### Index Creation Without Locking

Never create an index without `CONCURRENTLY` on a live table:

```sql
-- Blocks all writes for minutes on large tables
CREATE INDEX idx_orders_user ON orders(user_id);

-- Runs in background, does not block
CREATE INDEX CONCURRENTLY idx_orders_user ON orders(user_id);
```

`CONCURRENTLY` takes longer and cannot run inside a transaction, but it does not lock the table.

## The Zero-Downtime Checklist

Before every deployment:

- [ ] Does the new code read from any column that does not yet exist? (deploy schema before code)
- [ ] Does the migration add a column with `NOT NULL` and no default? (will lock the table)
- [ ] Are any indexes created without `CONCURRENTLY`?
- [ ] Are there any `ALTER TABLE` statements that change column types?
- [ ] Does the new code write to a column the old code does not know about?
- [ ] Is the migration idempotent? Can it be rerun safely?
- [ ] Is there a rollback plan for both the code and the schema?

## Health Check Configuration

Your deployment is only zero-downtime if the load balancer waits for the new instance to pass health checks before routing traffic, and wait for in-flight requests to complete before removing the old instance.

```yaml
# Kubernetes example
readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3

lifecycle:
  preStop:
    exec:
      command: ["sleep", "15"]   # Allow load balancer to drain connections
```

The `preStop` sleep is underrated. Without it, the pod is removed from service discovery before in-flight requests complete, causing 502s.

## Conclusion

Zero-downtime deployment is achievable without exotic infrastructure. The application must be designed for it from the start: backward-compatible schema changes, health-aware startup, graceful shutdown. The database migration pattern is the non-obvious part &mdash; get that right and the rest follows.
