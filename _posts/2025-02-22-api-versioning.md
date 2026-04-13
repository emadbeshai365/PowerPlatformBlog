---
layout: post
title: "API Versioning Strategies That Don't Break Clients"
date: 2025-02-22
description: "Header versioning, URL versioning, content negotiation &mdash; a comparison grounded in real API lifecycle management over years of production usage."
category: "Backend"
tags: [API Design]
read_time: "7 min read"
featured: false
---

Every API that outlives its first release version faces the same problem: how do you change the contract without breaking existing clients? There are three main strategies. Each makes a different trade-off between developer ergonomics, infrastructure complexity, and evolvability.

## Strategy 1: URL Versioning

```
GET /v1/users/123
GET /v2/users/123
```

The version is in the URL path. Every major breaking change gets a new path prefix.

**Pros:**
- Immediately visible in logs, browser history, and error reports.
- Easy to route at the load balancer or API gateway.
- Cacheable &mdash; URLs are stable and unique per version.

**Cons:**
- Resources appear at multiple URLs, violating REST's uniform interface principle (a minor theoretical concern in practice).
- Clients must update base URLs for every major version.
- Old versions must be maintained indefinitely for backward compatibility, or clients are broken on deprecation.

URL versioning is the right default for public APIs and developer-facing products. Its explicitness reduces support tickets.

## Strategy 2: Header Versioning

```http
GET /users/123
Accept-Version: 2025-04-01
```

Or with `Accept`:

```http
GET /users/123
Accept: application/vnd.emadbeshai.v2+json
```

**Pros:**
- Clean URLs &mdash; the resource lives at one URL.
- Version is part of the request semantics, not the resource identity.
- Works well with consumer-driven contract testing.

**Cons:**
- Invisible in browser URLs and most logging setups without explicit parsing.
- Harder to test in a browser without developer tools.
- Requires header-aware caching rules &mdash; CDNs and proxies must vary on the version header.

Header versioning is the right choice for internal service-to-service APIs where clients are always code, never humans, and you control both sides.

## Strategy 3: Date-Based Versioning (Stripe's Model)

Stripe popularised a compelling variant: the API version is a release date, and each client is pinned to the version active when they first integrated.

```http
GET /users/123
Stripe-Version: 2024-09-15
```

Clients never update unless they explicitly choose to. Breaking changes only affect new integrations. Old clients are automatically on their pinned version forever.

**Pros:**
- Zero forced migrations for existing clients.
- You can iterate aggressively without breaking anyone.
- Clear changelog: every date-version has a documented diff.

**Cons:**
- Complex to implement &mdash; every breaking change needs version-aware response transformation.
- Old behaviour must be maintained indefinitely.
- Testing surface grows with every version.

This is the right model for fintech and developer-platform APIs where breaking changes have real business consequences.

## What Actually Breaks Clients

Understanding the change taxonomy helps you decide which strategy matters:

| Change | Breaking? |
|--------|-----------|
| Adding a new field to a response | No |
| Removing a field | Yes |
| Renaming a field | Yes |
| Changing a field's type | Yes |
| Adding a new required request field | Yes |
| Adding a new optional request field | No |
| Changing a status code | Yes |
| Adding a new endpoint | No |

The practical conclusion: additive changes rarely need versioning. Implement an expansion policy (your API always accepts unknown fields, always sends all known fields) and you can iterate for years without a version bump.

## Recommendation

- **Public APIs, SDKs, external developers:** URL versioning (`/v1`, `/v2`).
- **Internal microservices:** Header versioning, enforced by API gateway.
- **Developer platform / fintech:** Date-pinned versioning.

In all cases: prefer additive changes, deprecate with a sunset header (`Sunset: Sat, 1 Jan 2026 00:00:00 GMT`), and communicate breaking changes at least six months ahead.

```http
# Signal upcoming deprecation in every response from a deprecated version
Deprecation: true
Sunset: Sat, 01 Jan 2026 00:00:00 GMT
Link: <https://api.example.com/v2/users>; rel="successor-version"
```

Your versioning strategy is a contract with your clients. Make it explicit, communicate changes early, and automate enforcement.
