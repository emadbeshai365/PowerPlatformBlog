---
layout: post
title: "Designing a Multi-Tenant Architecture That Actually Scales"
date: 2025-04-10
description: "Most multi-tenancy guides stop at row-level security. Here we go deeper &mdash; tenant isolation strategies, schema-per-tenant vs shared schema trade-offs, connection pooling at scale, and the subtle failure modes that only appear at 1,000+ tenants."
category: "System Design"
tags: [System Design, Databases]
read_time: "12 min read"
featured: true
series: "Scaling Series &middot; Part 1"
code_filename: "tenant_ctx.py"
code_snippet: |
  @contextmanager
  def tenant_ctx(db, tid):
      db.execute(
          "SET LOCAL app.t=:t",
          {"t": tid}
      )
      try:
          yield db
      finally:
          db.execute(
              "RESET app.t")
---

When you first build a SaaS product, multi-tenancy feels simple: add a `tenant_id` column to every table, filter every query. Done. But systems grow. What starts as row-level filtering becomes a liability when you reach hundreds &mdash; then thousands &mdash; of tenants.

This article breaks down the three main isolation models, when each collapses, and what the connection layer looks like under real load.

## The Three Isolation Models

There is a well-known spectrum from full isolation to full sharing:

| Model | Isolation | Cost | Limit |
|-------|-----------|------|-------|
| Database-per-tenant | Strongest | Highest | ~hundreds |
| Schema-per-tenant | Strong | Medium | ~thousands |
| Shared schema (row-level) | Weakest | Lowest | unlimited |

Most teams start at row-level and never revisit until the pain becomes acute.

### Row-Level Security: The Hidden Costs

Row-level security (RLS) using PostgreSQL's `SET LOCAL` and policies is elegant in small systems. But at 10,000 tenants making concurrent requests:

- Every query carries a planning overhead for the policy predicate.
- Index scans degrade when `tenant_id` is not the leading column.
- A missing `WHERE tenant_id = :t` in *one* place leaks data silently.

The fix for the last point is PostgreSQL's built-in RLS:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Pair this with a context manager that sets the session configuration on every connection checkout:

```python
@contextmanager
def tenant_ctx(db, tid):
    db.execute("SET LOCAL app.tenant_id = :t", {"t": str(tid)})
    try:
        yield db
    finally:
        db.execute("RESET app.tenant_id")
```

### Schema-Per-Tenant: Sweet Spot

Schema-per-tenant gives each customer their own namespace: `tenant_abc.orders`, `tenant_def.orders`. The same physical database, but a clean DDL boundary. Migrations run per-schema, making progressive rollouts trivial.

The catch: `search_path` must be set correctly on every connection. If you use PgBouncer in transaction mode, session-level settings do not persist. You must set `search_path` on every statement, or use statement-level pooling.

```sql
-- In your connection wrapper
SET search_path TO tenant_abc, public;
```

### When to Use Database-Per-Tenant

At enterprise scale with strict compliance requirements (HIPAA, SOC 2 Type II), database isolation is sometimes not optional. The trade-off: you now manage N databases, their backups, extensions, vacuums, and replication.

Use this model only when contractual obligations require it or when a single tenant's workload can saturate a shared instance.

## Connection Pooling at Scale

The failure mode nobody talks about: at 1,000 tenants &times; 25 connections each = 25,000 connections. PostgreSQL defaults to 100. You will hit this wall.

The solution stack:
1. **PgBouncer** (transaction mode) in front of every replica.
2. **Application-level connection limit** per tenant.
3. **Tenant circuit breakers**: if one tenant's slow queries queue up, isolate them.

```python
# Limit per-tenant concurrent connections
TENANT_POOL_SIZE = int(os.getenv("TENANT_POOL_SIZE", "3"))

class TenantPool:
    def __init__(self):
        self._semaphores = {}

    def get(self, tenant_id: str):
        if tenant_id not in self._semaphores:
            self._semaphores[tenant_id] = asyncio.Semaphore(TENANT_POOL_SIZE)
        return self._semaphores[tenant_id]
```

## The Subtle Failure Modes

After running a shared-schema multi-tenant system at significant scale, these are the failure modes you only see in production:

1. **Tenant A's heavy query starves Tenant B.** Solution: query timeouts per tenant, separate read replicas for analytics workloads.
2. **Schema migration locks the shared table.** Solution: always use `CONCURRENTLY` for index creation, zero-downtime migration patterns.
3. **A bug in the context manager leaks tenant data.** Solution: integration tests that assert cross-tenant isolation on every query path.

## Conclusion

The right model depends on scale, compliance requirements, and team capacity. Start with shared schema + RLS for speed, design the context propagation correctly from day one, and plan the migration path to schema-per-tenant before you need it.

The connection pooling layer is where most teams get surprised &mdash; address it before you hit a wall at 3 AM.
