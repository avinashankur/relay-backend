# 001-ADR: Adopt a Modular Monolith Architecture

**Date:** -
**Status:** Accepted
**Deciders:** Engineering Team
**Tags:** architecture, deployment, codebase-structure

---

## Context

We are building Relay, an enterprise-grade multi-tenant identity and authentication backend platform. The system must be scalable, secure, and highly maintainable to serve as a central authentication and authorization layer for modern web applications.

In the initial design phase, we need to decide the core structural pattern of the application. The system will handle distinct domains: core authentication logic, user management, session lifecycle, organizational hierarchies, and administrative tasks.

While a microservices architecture offers independent scalability per domain, it introduces significant operational complexity (distributed tracing, network latency, eventual consistency, complex CI/CD). Conversely, a traditional layered monolith (grouping files by type like `controllers/`, `services/`, `models/` globally) often degrades into a highly coupled "big ball of mud" where boundaries blur over time.

## Decision

We will build Relay as a **Modular Monolith**.

The application will be organized into self-contained domain modules (e.g., `src/modules/auth`, `src/modules/sessions`, `src/modules/users`). Each module will encapsulate its own routes, controllers, services, and schemas, interacting with other modules only through explicit service-level APIs. The entire application will be compiled and deployed as a single artifact (a single Docker image).

_Note: Background tasks (like emails and cleanups) will be deployed as a separate worker process to prevent blocking the main API thread, but they will still share the same monolithic codebase and build artifact._

## Alternatives Considered

### Option A: Microservices

- **Description:** Deploying each domain (`auth`, `users`, `sessions`) as a standalone API service with its own database.
- **Pros:** Independent scaling (we could scale the auth service to handle spikes without scaling the admin service), independent deployments, strong enforcement of boundaries via network partitions.
- **Cons:** High operational overhead. Requires complex CI/CD pipelines, API gateways, distributed tracing, and handling network partitions. Refactoring across domain boundaries is extremely difficult.
- **Why we didn't choose it:** The overhead of managing microservices at the start of the project far outweighs the benefits. A single team building a new product needs agility and simplicity to iterate quickly.

### Option B: Traditional Layered Monolith

- **Description:** Organizing the codebase globally by technical concern: all routes in a `routes/` folder, all controllers in `controllers/`, and all business logic in `services/`.
- **Pros:** The standard default for most Express/Node.js tutorials; very fast to start.
- **Cons:** Promotes high coupling between domains. A change in the auth domain might easily leak into the user domain. Over time, extracting a domain into a microservice becomes nearly impossible due to tangled dependencies.
- **Why we didn't choose it:** It fails to protect business boundaries. For an enterprise identity platform, strict separation of concerns (e.g., session management vs. core auth logic) is a hard requirement for security and maintainability.

## Consequences

### Positive

- **Deployment Simplicity:** A single deployable unit (the API server) simplifies CI/CD, local development, and infrastructure.
- **No Network Boundaries:** Inter-domain communication happens via function calls in memory, completely avoiding network latency and distributed transaction complexities.
- **Future-Proofing:** Because the code is organized by domain with strict boundaries, extracting a module (like `sessions` or `emails`) into a separate microservice later will be a straightforward refactor if scaling demands it.

### Negative

- **Coupled Scaling:** If the `auth` module needs more compute power due to heavy login traffic, the entire monolith must be horizontally scaled.
- **Discipline Required:** Since there are no hard network boundaries enforcing separation, engineers must rely on discipline and strict linting rules (e.g., `eslint-plugin-boundaries`) to prevent cross-module coupling.

## Follow-up Actions

- [ ] Implement `eslint-plugin-boundaries` to enforce strict import rules between `src/modules/*`.
- [ ] Ensure all database queries are isolated within their respective domain service layers.
