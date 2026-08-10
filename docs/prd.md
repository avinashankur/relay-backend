# PRODUCT.md

> Product context for the Relay team. Updated 2026-08-09.

---

## What is Relay?

Relay is an enterprise-grade multi-tenant identity and authentication platform tailored for B2B SaaS companies. It serves as a drop-in backend API that manages user identities, robust session lifecycles, and asynchronous background tasks (like transactional emails). It allows SaaS engineering teams to own their authentication data and infrastructure without having to build complex auth flows from scratch.

---

## Users

### Primary User

**Who:** CTOs and Lead Engineers at Mid-Market SaaS companies.
**Sophistication:** Highly Technical.
**Core job:** Building and scaling a secure B2B software product while maintaining velocity on core features.
**Current pain:** They are forced to choose between building auth from scratch (which distracts from their core product and risks security flaws) or using a managed service like Auth0/Clerk (which locks them in, becomes prohibitively expensive at scale, and poses data sovereignty issues).
**What they get:** A self-hostable, open-core auth backend that provides Auth0-level features while keeping data completely within their own infrastructure.

### Secondary Users

| User type           | Their role                 | What they need from this product                                        |
| ------------------- | -------------------------- | ----------------------------------------------------------------------- |
| End Users           | Users of the SaaS app      | Fast, frictionless, and secure login experiences (Magic Links, OTP).    |
| Security Operations | SecOps/Compliance Officers | Full audit trails, session revocation, and data sovereignty compliance. |

---

## Problem Statement

Engineering teams at growing SaaS companies waste hundreds of hours reinventing authentication, session management, and transactional email flows. When they outgrow simple MVP auth, they often turn to expensive managed identity providers. This creates severe vendor lock-in, makes it difficult to comply with strict data residency laws, and leads to unpredictable cost scaling as their monthly active users (MAUs) grow.

---

## Value Proposition

**Core value:** Relay provides the feature completeness of a managed identity provider with the data sovereignty and cost predictability of a self-hosted solution.

We are the only solution that combines a modular, deploy-anywhere Node.js monolith with enterprise-ready session rotation because we prioritize complete developer ownership over vendor-hosted black boxes.

---

## What This Product Does NOT Do

- **Does NOT provide frontend UI components:** We are purely a backend API. Clients are expected to build their own UI or use our headless SDKs.
- **Does NOT handle user billing or subscriptions:** We integrate with Stripe/Paddle, but we do not manage the payment lifecycle.
- **Does NOT act as a public IdP (Identity Provider):** We do not intend to become a public social login provider like "Sign in with Google."
- **Does NOT manage infrastructure orchestration:** We provide the Docker containers, but the user is responsible for Kubernetes/ECS orchestration.

---

## Success Metrics

### North Star Metric

**Active Tenants (SaaS Deployments):** Measures how many distinct companies are successfully running Relay in production to secure their own applications.

### Key Metrics

| Metric                              | Target   | Current | Trend      |
| ----------------------------------- | -------- | ------- | ---------- |
| Time-to-first-successful-auth (Dev) | < 15 min | TBD     | Baseline   |
| Production Deployments              | 50       | 0       | Pre-launch |
| API Error Rate                      | < 0.1%   | N/A     | N/A        |

---

## Current Stage and Priorities

**Stage:** Pre-launch (Building Core Auth MVP)

**Top 3 priorities this quarter:**

1. **Build Top-Tier Auth Capabilities** — Finish exposing core endpoints (login, logout, refresh, magic links, OTP) to reach feature parity with basic managed providers.
2. **Harden Session Security** — Complete refresh-token rotation, reuse detection, and session revocation APIs so the platform is safe for production use.
3. **Developer Experience & Operations** — Define robust local setups (Docker), clean API documentation, and CI workflows to make adoption as frictionless as possible.

---

## Competitive Landscape

| Competitor        | Their strength                         | Our advantage                                             | Who they win with                               |
| ----------------- | -------------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| **Auth0**         | Massive ecosystem and feature set      | Self-hostable, predictable pricing, zero vendor lock-in   | Enterprises wanting fully managed SaaS          |
| **Clerk**         | Incredible Next.js/React frontend SDKs | Pure backend focus, complete control over the database    | Frontend-heavy solo developers and startups     |
| **Supabase Auth** | Tightly integrated with Postgres       | Agnostic to the broader stack; highly specialized in auth | Teams already using the full Supabase ecosystem |

---

## Product Principles

1. **Data Sovereignty First:** The customer must always own their database and user records. We never hold their data hostage.
2. **Stateless Scalability:** The API must remain stateless. All state goes to Postgres or Redis to allow infinite horizontal scaling.
3. **Fail Securely:** If a token is reused or an anomaly is detected, we automatically revoke all associated sessions. Security trumps convenience.
4. **No Black Boxes:** The architecture must be transparent and understandable by a mid-level engineer within an afternoon.

---

## Key Decisions Made

- **Decision:** Use Prisma and PostgreSQL (2026-08) — Provides the most robust relational safety and developer experience for storing identity data.
- **Decision:** Opaque Refresh Tokens via Redis (2026-08) — Ensures we can instantly revoke sessions and detect token theft without relying on slow database queries.

---

## Related Documents

- [README](../README.md) — Technical orientation
- [Architecture](../ARCHITECTURE.md) — System design
- [Context](../CONTEXT.md) — Development constraints and invariant rules
