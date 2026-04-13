---
layout: post
title: "Event Sourcing: When It Helps and When It Hurts"
date: 2025-03-28
description: "A candid look at event sourcing in production &mdash; wins in audit trails and temporal queries, and the pain of eventual consistency at 3 am."
category: "Backend"
tags: [Backend, Architecture]
read_time: "8 min read"
featured: false
---

Event sourcing is one of those patterns that sounds elegant in every conference talk and becomes a liability in every on-call rotation. That experience from two production systems is what this article is about.

## What Event Sourcing Actually Is

Instead of storing current state, you store every state change as an immutable event. The current state is always a projection &mdash; a left fold over the event stream.

```python
# Traditional: store current balance
UPDATE accounts SET balance = 1500 WHERE id = :id

# Event sourcing: store the fact
INSERT INTO events (aggregate_id, type, payload, occurred_at)
VALUES (:id, 'MoneyDeposited', '{"amount": 500}', NOW())
```

Your read model is rebuilt from events: `balance = sum(deposits) - sum(withdrawals)`.

## Where Event Sourcing Genuinely Wins

### Complete Audit Trail

Regulatory requirements become trivial. "Show me every change to this record and who made it" is a simple query against the event log &mdash; not a retrofitted audit table that misses half the mutations.

### Temporal Queries

"What was the state of this account on March 15th?" is a matter of replaying events up to that date. With a traditional store, this requires either snapshots or a time-travel extension like `temporal_tables`.

### Debugging in Production

When a bug causes corrupt state, you have the full history. You can replay events, stop before the bad one, and examine exactly what happened. In a traditional system, the corrupt state is all you have.

### Event-Driven Integration

Events are first-class artifacts you can publish to a message bus. Downstream services subscribe without polling. This is architecturally clean in a way that change data capture (CDC) from a traditional store is not.

## Where Event Sourcing Hurts

### Schema Evolution Is Painful

Events are immutable. When your `OrderPlaced` event shape changes, you cannot update old events. You need migration events, upcasters, or versioned schemas. Every consumer must handle every version of every event. This becomes a combinatorial maintenance problem quickly.

```python
def upcast_order_placed(event: dict) -> dict:
    if event["version"] == 1:
        # v1 had no `currency` field, default to USD
        event["payload"]["currency"] = "USD"
        event["version"] = 2
    return event
```

### Eventual Consistency Is Not Optional

Your read models are projections built asynchronously. During a replay or a projection rebuild, your application serves stale data. This is a feature in some contexts and a critical bug in others. If your product requires strong consistency for any operation, event sourcing will force you to work around it.

### Queries Are Not Native

Searching across aggregates requires projections. "Give me all open orders for customers in Germany" means maintaining a separate read-optimised store. You are running two data systems now.

### The 3 AM Problem

A projection falls behind. Your read model is hours stale. The business is calling. Replaying millions of events takes time. Having runbooks for this scenario is not optional.

## The Decision Criteria

Use event sourcing when:
- Audit trails are a hard requirement (finance, healthcare, legal).
- Temporal queries are core to the product (not just nice to have).
- Your domain is naturally event-driven (e.g., accounting, logistics).
- Your team has experience with eventual consistency.

Avoid event sourcing when:
- You need simple CRUD with complex queries.
- The team is small and iteration speed is paramount.
- Strong consistency is required across aggregates.
- You have no operational experience with projection rebuilds.

## Conclusion

Event sourcing is a powerful tool with a real operational cost. The audit trail and temporal query benefits are genuine. But the schema evolution problem, the projection management overhead, and the eventual consistency constraints are also genuine. The pattern earns its complexity only when the benefits are required &mdash; not just attractive.
