---
layout: post
title: "PostgreSQL Index Strategies That Changed Our Query Plans"
date: 2025-03-05
description: "Partial indexes, covering indexes, expression indexes &mdash; with real EXPLAIN ANALYZE output before and after. Numbers don't lie."
category: "Databases"
tags: [Databases, Performance]
read_time: "10 min read"
featured: false
---

Most PostgreSQL performance problems are index problems. Not missing indexes &mdash; wrong indexes. This article covers three underused index types that changed real query plans in production, with actual `EXPLAIN ANALYZE` output.

## 1. Partial Indexes: Index a Subset of Rows

The standard advice is to index columns you query on. The better advice is to index only the rows you actually query.

**The scenario:** An `orders` table with 50 million rows. 98% are in a `completed` status. The application almost exclusively queries `pending` and `processing` orders &mdash; about 100,000 rows.

A full index on `status` is 50M entries. A partial index is 100K entries &mdash; 500&times; smaller, fits in memory, dramatically faster.

```sql
-- Standard index: 50M entries
CREATE INDEX idx_orders_status ON orders(status);

-- Partial index: ~100K entries
CREATE INDEX idx_orders_active ON orders(status)
WHERE status IN ('pending', 'processing');
```

**EXPLAIN ANALYZE &mdash; before:**

```
Bitmap Heap Scan on orders  (cost=2847.00..38291.00 rows=51847 width=284)
  Recheck Cond: (status = 'pending')
  ->  Bitmap Index Scan on idx_orders_status
        Index Cond: (status = 'pending')
Planning Time: 0.4 ms
Execution Time: 847.3 ms
```

**After:**

```
Index Scan using idx_orders_active on orders  (cost=0.42..8.45 rows=100 width=284)
  Index Cond: (status = 'pending')
Planning Time: 0.3 ms
Execution Time: 1.2 ms
```

847ms → 1.2ms. The entire index fits in the buffer pool.

## 2. Covering Indexes: Eliminate Heap Fetches

An index scan returns the row's `ctid`, then fetches the actual row from the heap (table). For read-heavy queries that select specific columns, a covering index eliminates that second lookup entirely.

**The scenario:** A reports query that selects `user_id`, `amount`, `created_at` from orders for a date range. The table is 800MB. The relevant index is on `created_at` alone.

```sql
-- Before: index on created_at only
CREATE INDEX idx_orders_date ON orders(created_at);

-- After: covering index &mdash; no heap fetch needed
CREATE INDEX idx_orders_date_cover ON orders(created_at)
  INCLUDE (user_id, amount);
```

**EXPLAIN ANALYZE &mdash; before:**

```
Index Scan using idx_orders_date on orders
  Index Cond: ((created_at >= '2025-01-01') AND (created_at < '2025-02-01'))
  Buffers: shared hit=1247 read=8934     ← 8934 heap blocks read
Execution Time: 210.4 ms
```

**After:**

```
Index Only Scan using idx_orders_date_cover on orders
  Index Cond: ((created_at >= '2025-01-01') AND (created_at < '2025-02-01'))
  Heap Fetches: 0                        ← zero heap reads
  Buffers: shared hit=312
Execution Time: 18.7 ms
```

210ms → 18.7ms. `Index Only Scan` and zero heap fetches.

## 3. Expression Indexes: Index Computed Values

If your application queries on `LOWER(email)` or `DATE(created_at)`, a standard index on the raw column is useless. PostgreSQL has to evaluate the expression for every row.

```sql
-- Queries on lower-cased email fail to use a plain index
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- Expression index &mdash; indexes the computed value
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
```

After this, `LOWER(email) = :val` uses an index scan and planning time goes from a sequential scan over 2M rows (~900ms) to an index scan (~0.4ms).

The same pattern applies to `date_trunc('day', created_at)` for daily aggregation queries.

## Diagnostic First

Before adding any index, run:

```sql
-- Find slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Find unused indexes (wasteful write overhead)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;
```

Remove unused indexes before adding new ones. Each index slows writes and increases vacuum overhead.

## Key Takeaways

1. **Partial indexes** for queries that filter on low-cardinality columns with skewed distributions.
2. **Covering indexes** for read-heavy queries that select specific columns on large tables.
3. **Expression indexes** when your queries use functions in `WHERE` clauses.
4. Always measure &mdash; `EXPLAIN (ANALYZE, BUFFERS)` before and after every change.
