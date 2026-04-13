---
layout: post
title: "Rate Limiting Algorithms Explained with Code"
date: 2025-01-28
description: "Token bucket, sliding window log, sliding window counter &mdash; each with Python implementations and an honest comparison of trade-offs at scale."
category: "Backend"
tags: [Algorithms, Security]
read_time: "5 min read"
featured: false
---

Rate limiting is one of those topics where the naive implementation works fine in development and silently fails in production. The choice of algorithm determines your accuracy, memory usage, and behaviour under burst traffic. Here are the three algorithms worth knowing.

## 1. Token Bucket

A bucket holds up to `capacity` tokens. Tokens refill at a fixed rate. Each request consumes one token. If the bucket is empty, the request is rejected.

```python
import time
import threading

class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity    = capacity
        self.tokens      = float(capacity)
        self.refill_rate = refill_rate      # tokens per second
        self.last_refill = time.monotonic()
        self._lock       = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            now     = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.refill_rate
            )
            self.last_refill = now
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False
```

**Characteristics:**
- Allows bursts up to `capacity` then enforces `refill_rate` sustained.
- O(1) memory per client.
- Slightly complex distributed implementation (requires atomic compare-and-swap in Redis).

**Best for:** APIs with bursty legitimate traffic (e.g., SDKs that batch requests on startup).

## 2. Sliding Window Log

Store the timestamp of every request in the last window. Count requests in the window for each incoming request.

```python
from collections import deque

class SlidingWindowLog:
    def __init__(self, limit: int, window_seconds: int):
        self.limit   = limit
        self.window  = window_seconds
        self.log: deque[float] = deque()
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            now    = time.monotonic()
            cutoff = now - self.window
            while self.log and self.log[0] <= cutoff:
                self.log.popleft()
            if len(self.log) < self.limit:
                self.log.append(now)
                return True
            return False
```

**Characteristics:**
- Exact &mdash; counts every request in a true sliding window.
- O(limit) memory per client in the worst case.
- Impractical at high limits (storing millions of timestamps).

**Best for:** Low-volume APIs where accuracy is critical (e.g., payment processing at 100 req/min).

## 3. Sliding Window Counter

Approximate a sliding window using two fixed counters: the current window and the previous window. Weight the previous window's count by the overlap ratio.

```python
class SlidingWindowCounter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit   = limit
        self.window  = window_seconds
        self._lock   = threading.Lock()
        self.prev_count    = 0
        self.curr_count    = 0
        self.curr_start    = time.monotonic()

    def allow(self) -> bool:
        with self._lock:
            now     = time.monotonic()
            elapsed = now - self.curr_start
            if elapsed >= self.window:
                self.prev_count = self.curr_count
                self.curr_count = 0
                self.curr_start = now
                elapsed         = 0
            overlap = (self.window - elapsed) / self.window
            estimated = self.prev_count * overlap + self.curr_count
            if estimated < self.limit:
                self.curr_count += 1
                return True
            return False
```

**Characteristics:**
- Approximate but accurate within ~0.1% of the true sliding window.
- O(1) memory per client regardless of limit.
- Easy to implement in Redis with two keys and an atomic increment.

**Best for:** High-volume APIs (millions of requests/hour) where memory efficiency matters more than perfect accuracy.

## Comparison

| Algorithm | Memory | Accuracy | Burst Handling | Distributed |
|-----------|--------|----------|----------------|-------------|
| Token Bucket | O(1) | Exact | Allows | Complex |
| Sliding Window Log | O(limit) | Exact | No | Expensive |
| Sliding Window Counter | O(1) | ~99.9% | No | Simple |

## Redis Implementation

For distributed systems, all three translate to Redis operations. The sliding window counter is the most practical:

```python
import redis

def redis_sliding_window(r: redis.Redis, key: str, limit: int, window: int) -> bool:
    now       = int(time.time())
    curr_key  = f"{key}:{now // window}"
    prev_key  = f"{key}:{now // window - 1}"

    pipe = r.pipeline()
    pipe.incr(curr_key)
    pipe.expire(curr_key, window * 2)
    pipe.get(prev_key)
    curr, _, prev_raw = pipe.execute()

    prev    = int(prev_raw or 0)
    overlap = 1 - (now % window) / window
    return (prev * overlap + curr) < limit
```

Two Redis keys per client, two round trips batched into one pipeline. Scales to millions of clients with negligible memory overhead.

## Conclusion

Token bucket for burst-tolerant APIs. Sliding window log when you need exact counts at low volume. Sliding window counter for everything else at scale. The Redis implementation of the counter is the production workhorse &mdash; simple to reason about, cheap to operate.
