# Relay Engineering Backlog

## Project Snapshot

Relay is currently an early-stage TypeScript identity/auth backend built on Express 5, Prisma/Postgres, Redis, BullMQ, and React Email. The repo already includes `/health` and `/health/ready` endpoints, a working signup path, a Prisma schema for users/auth accounts/sessions/audit events, an email queue plus worker handlers, and core environment validation. Most of the broader identity-platform scope described in `docs/` is still target-state planning rather than implemented runtime behavior.

## Prioritization Legend

- `P0`: critical path to a usable and testable auth MVP
- `P1`: important hardening, delivery, and maintainability work needed right after MVP
- `P2`: follow-on expansion, polish, or documentation work that should not block core delivery

## Status Markers

- `Not started`
- `In progress`
- `Blocked`
- `Done`

## Task ID Scheme

Each task carries a stable `PREFIX-NN` identifier. IDs are **never reused or renumbered** — inserting or removing a task does not affect any other ID. New tasks always get the next unused number within their prefix.

| Prefix  | Workstream                    |
| ------- | ----------------------------- |
| `REPO`  | Product Naming & Repo Hygiene |
| `AUTH`  | Core Auth API Completion      |
| `SEC`   | Session & Security Hardening  |
| `EMAIL` | Email & Background Processing |
| `TEST`  | Testing & Quality Gates       |
| `DOCS`  | Documentation & Operations    |

Cross-reference format in code comments: `See TODO.md [PREFIX-NN]`

## Current-State Gaps

- The `AuthService`, `SessionService`, `UserService`, and `AdminService` have implementation and test coverage.
- Several core endpoints are missing explicit controller/routing wire-ups, particularly in `auth` (login, logout, refresh, reset) and other domain modules (only `/auth/signup` is wired).
- `package.json` has `test` scripts but lacks a fully-featured CI pipeline (no `.github/workflows/`).
- Graceful shutdown is incomplete in `src/server.ts`; Prisma and Redis disconnect paths are commented out.
- API and worker runtime boundaries are not cleanly separated into dedicated entrypoints/process contracts yet.
- Email workers exist but lack production-grade retry, dead-letter, and operational configurations in BullMQ.
- Three middleware functions (`parseToken`, `requireAuth`, `requireRole`, `requireSession`) are fully implemented and exported from `src/shared/middleware/index.ts`. A singleton `JwtService` is wired in `createApp` and injected into all router factories. The `parseToken` middleware accepts both cookie and `Authorization: Bearer` token sources, and propagates `sessionId` into `req.user`. The `requireSession` middleware enforces session liveness in the DB for sensitive routes (admin, sessions).

## Delivery Backlog By Workstream

### 1. Product Naming And Repo Hygiene

Goal: remove stale product identity and make the repository's source of truth consistent.

- [x] `REPO-01` `P0` `Done` Adopt `Relay` as the canonical project/product name and apply it consistently across source, docs, email copy, env defaults, and operational text.
- [x] `REPO-02` `P0` `Done` Rename stale legacy references in `src/config/env.ts`, email templates, layout/footer copy, validation error banners, and any auth-facing strings that surface externally.
- [x] `REPO-03` `P0` `Done` Update JWT issuer/audience identifiers in the active JWT service so tokens do not continue to carry legacy product naming.
- [x] `REPO-04` `P1` `Done` Rewrite docs and prompts that still use the old product name so planning documents stop diverging from the actual repo identity.
- [x] `REPO-05` `P1` `Done` Decide whether `dist/` should remain committed, be regenerated only in CI, or be excluded from planning and review workflows; `.gitignore` and linting already exclude `dist/`, but the policy is not documented and the build does not clean stale artifacts.
- [x] `REPO-06` `P1` `Done` Fix repo typos and naming defects that will leak into production if left unchanged; the source handler has been corrected to `send-security-alert.ts`, but stale typo-named files still exist in ignored `dist/` output.

### 2. Core Auth API Completion

Goal: turn the current signup-only surface into a coherent auth API module.

- [x] `AUTH-01` `P0` `Done` Finish route and controller coverage for existing service capabilities so login is exposed and behaves consistently with signup.
- [x] `AUTH-02` `P0` `Done` Add logout and refresh endpoints with explicit cookie handling, token rotation behavior, and failure responses; the endpoints exist, but the controller reads `refreshToken` while cookies are set as `refresh_token`, and the production refresh-cookie path does not match the mounted `/api/v1/auth/refresh` route.
- [x] `AUTH-03` `P0` `Done` Add email verification callback and resend-verification endpoints backed by the existing verification token flow in Redis; verification exists, but there is no resend-verification endpoint yet.
- [x] `AUTH-04` `P0` `Done` Add password reset request and confirm endpoints, including token issuance, validation, expiration, and audit logging.
- [x] `AUTH-05` `P1` `Done` Add magic-link request and callback endpoints using the existing email/queue infrastructure.
- [x] `AUTH-06` `P1` `Done` Add OTP request and verify endpoints with bounded verification attempts and expiry handling.
- [x] `AUTH-07` `P0` `Done` Complete request validation schemas for every auth endpoint and make controller error responses consistent with the shared error model; most auth flows have schemas, but validation and controller behavior still diverge in places, including refresh/logout cookie handling and verification route semantics.
- [x] `AUTH-08` `P1` `Done` Document expected cookie and token behavior for each auth endpoint so frontend and test implementations have a stable contract; see `docs/auth-contract.md` for the canonical per-endpoint reference.

### 3. Session And Security Hardening

Goal: make session management intentional, testable, and safe to run in production.

- [x] `SEC-01` `P0` `Done` Decide and enforce the email-verification policy during login and other privileged auth flows instead of leaving the check commented out.
- [x] `SEC-02` `P0` `Done` Finish refresh-token rotation and reuse-detection behavior, including explicit session invalidation and audit trails for reuse events.
- [x] `SEC-03` `P0` `Done` Add session list and revoke APIs so users and future admin flows can inspect and terminate active sessions.
- [x] `SEC-04` `P1` `Done` Add middleware for request identity extraction, authenticated route protection, and role enforcement to support non-public APIs.
- [x] `SEC-05` `P1` `Done` Add or document missing CSRF and rate-limiting behavior for auth endpoints so brute-force and cross-site request protections are not left implicit.
- [x] `SEC-06` `P1` `Done` Complete graceful shutdown by disconnecting Prisma, Redis, queues, and workers cleanly on process termination.

### 4. Email And Background Processing

Goal: make outbound email flows production-grade and operationally reliable.

- [x] `EMAIL-01` `P1` `Done` Upgrade React Email templates to production quality with consistent branding, better copy, stronger fallback text, and clean CTA language.
- [x] `EMAIL-02` `P1` `Done` Verify every required email flow is present and wired end-to-end: verification, magic link, OTP, password reset, and security alerts.
- [ ] `EMAIL-03` `P1` `Not started` Separate API and worker entrypoints cleanly so background jobs can run as an independent process/container with explicit startup and shutdown behavior.
- [ ] `EMAIL-04` `P1` `Not started` Define retry, backoff, dead-letter, and alerting expectations for BullMQ email jobs instead of relying on default queue behavior.
- [ ] `EMAIL-05` `P2` `Not started` Add operational checks around queue health, stuck jobs, and handler-level logging so email failures are diagnosable without code spelunking.

### 5. Testing And Quality Gates

Goal: make the repo safe to change by adding executable verification around critical auth flows.

- [x] `TEST-01` `P0` `Done` Add a `typecheck` script and baseline test scripts to `package.json` so the project has first-class verification commands.
- [x] `TEST-02` `P0` `Done` Introduce unit tests for `AuthService`, `SessionService`, `UserService`, `AdminService` and security-sensitive shared services with mocked external dependencies.
- [ ] `TEST-03` `P0` `Not started` Add integration tests for signup, login, refresh, and email verification using real Prisma/Redis-backed flows where practical.
- [ ] `TEST-04` `P0` `Not started` Cover the highest-risk cases first: token rotation, token reuse, duplicate signup, invalid credentials, and verification token expiry.
- [ ] `TEST-05` `P1` `Not started` Add a minimum CI workflow that runs lint, typecheck, tests, and build on pull requests.
- [ ] `TEST-06` `P1` `Not started` Define the minimum test data/setup strategy for Prisma and Redis so local and CI runs are reproducible.

### 6. Documentation And Operations

Goal: align repo documentation with the actual system boundary and make the project operable by another engineer.

- [ ] `DOCS-01` `P1` `Not started` Rewrite architecture and planning docs to distinguish clearly between implemented behavior and future-state goals.
- [ ] `DOCS-02` `P1` `Not started` Add a root `README.md` with local setup, required services, scripts, and a truthful implementation status summary.
- [ ] `DOCS-03` `P1` `Not started` Add a `.env.example` that reflects the current validated environment contract without shipping real secrets.
- [ ] `DOCS-04` `P2` `Not started` Keep deployment and infrastructure work tracked as future backlog items, but stop presenting them as if they already exist in-repo.
- [ ] `DOCS-05` `P2` `Not started` Add an observability backlog covering Sentry wiring, request IDs, metrics, and an incident runbook once the API surface is stable.

## Near-Term Milestones

### Phase 1: Stabilize Core Auth MVP

- Expose the missing core auth endpoints beyond signup.
- Finish session rotation/reuse protection and make email verification policy explicit.
- Add typecheck, unit tests, and core integration tests for auth flows.
- Remove or quarantine stale legacy naming that affects runtime and user-facing behavior.

### Phase 2: Harden Operations And Delivery

- Separate worker and API process boundaries cleanly.
- Finish graceful shutdown and queue operational behavior.
- Add CI workflows and reproducible local/test setup.
- Rewrite docs so current-state implementation and future-state plans are clearly separated.

### Phase 3: Expand Product Surface

- Add remaining auth methods such as magic link and OTP if they are not completed in Phase 1.
- Add session management UX/API depth, admin capabilities, and broader platform features after core correctness is established.
- Expand observability, deployment, and infrastructure documentation once the service contract is stable.

## Definition Of Done

- The backlog preserves and expands the two original TODO themes: renaming the project and improving email templates.
- Every item in this file maps either to observed repo state or to a clearly labeled next-step capability gap.
- No task implies that unimplemented auth, CI, infra, or docs capabilities already exist.
- `P0` items focus first on auth completion, security-critical behavior, and test coverage.
- Another engineer can use this file as the repo's execution backlog without needing to reinterpret vague goals.
- Every task has a stable `PREFIX-NN` ID that can be referenced from in-code `// TODO(Px):` comments.
