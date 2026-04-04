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

## Current-State Gaps

- Only `POST /api/v1/auth/signup` is currently routed; the broader auth API surface is not exposed yet.
- `AuthService` contains additional logic such as login, but routing and controller coverage do not match the intended module scope.
- `package.json` has no `typecheck`, unit test, integration test, or CI-oriented scripts yet.
- `docs/architecture.md` and `docs/relay_build_prompt.md` mostly describe an aspirational future-state platform, not the current implementation boundary.
- Graceful shutdown is incomplete in `src/server.ts`; Prisma and Redis disconnect paths are commented out.
- API and worker runtime boundaries are not cleanly separated into dedicated entrypoints/process contracts yet.
- No `.github/workflows/` CI pipeline exists in the repo even though the docs assume one.
- Email and worker coverage exists, but production-grade retry, dead-letter, and operational guarantees are not documented or validated.
- The repo includes built output under `dist/`, which can confuse source-of-truth planning when stale branding or generated artifacts drift from `src/`.

## Delivery Backlog By Workstream

### 1. Product Naming And Repo Hygiene

Goal: remove stale product identity and make the repository’s source of truth consistent.

- [ ] `P0` `Done` Adopt `Relay` as the canonical project/product name and apply it consistently across source, docs, email copy, env defaults, and operational text.
- [ ] `P0` `Done` Rename stale legacy references in `src/config/env.ts`, email templates, layout/footer copy, validation error banners, and any auth-facing strings that surface externally.
- [ ] `P0` `Not started` Update JWT issuer/audience identifiers in the active JWT service so tokens do not continue to carry legacy product naming.
- [ ] `P1` `Not started` Rewrite docs and prompts that still use the old product name so planning documents stop diverging from the actual repo identity.
- [ ] `P1` `Not started` Decide whether `dist/` should remain committed, be regenerated only in CI, or be excluded from planning and review workflows; document that choice and enforce it consistently.
- [ ] `P1` `Not started` Fix repo typos and naming defects that will leak into production if left unchanged, including `send-secuirty-alert.ts`.

### 2. Core Auth API Completion

Goal: turn the current signup-only surface into a coherent auth API module.

- [ ] `P0` `Not started` Finish route and controller coverage for existing service capabilities so login is exposed and behaves consistently with signup.
- [ ] `P0` `Not started` Add logout and refresh endpoints with explicit cookie handling, token rotation behavior, and failure responses.
- [ ] `P0` `Not started` Add email verification callback and resend-verification endpoints backed by the existing verification token flow in Redis.
- [ ] `P0` `Not started` Add password reset request and confirm endpoints, including token issuance, validation, expiration, and audit logging.
- [ ] `P1` `Not started` Add magic-link request and callback endpoints using the existing email/queue infrastructure.
- [ ] `P1` `Not started` Add OTP request and verify endpoints with bounded verification attempts and expiry handling.
- [ ] `P0` `Not started` Complete request validation schemas for every auth endpoint and make controller error responses consistent with the shared error model.
- [ ] `P1` `Not started` Document expected cookie and token behavior for each auth endpoint so frontend and test implementations have a stable contract.

### 3. Session And Security Hardening

Goal: make session management intentional, testable, and safe to run in production.

- [ ] `P0` `Not started` Decide and enforce the email-verification policy during login and other privileged auth flows instead of leaving the check commented out.
- [ ] `P0` `Not started` Finish refresh-token rotation and reuse-detection behavior, including explicit session invalidation and audit trails for reuse events.
- [ ] `P0` `Not started` Add session list and revoke APIs so users and future admin flows can inspect and terminate active sessions.
- [ ] `P1` `Not started` Add middleware for request identity extraction, authenticated route protection, and role enforcement to support non-public APIs.
- [ ] `P1` `Not started` Add or document missing CSRF and rate-limiting behavior for auth endpoints so brute-force and cross-site request protections are not left implicit.
- [ ] `P1` `Not started` Complete graceful shutdown by disconnecting Prisma, Redis, queues, and workers cleanly on process termination.

### 4. Email And Background Processing

Goal: make outbound email flows production-grade and operationally reliable.

- [ ] `P1` `Not started` Upgrade React Email templates to production quality with consistent branding, better copy, stronger fallback text, and clean CTA language.
- [ ] `P1` `Not started` Verify every required email flow is present and wired end-to-end: verification, magic link, OTP, password reset, and security alerts.
- [ ] `P1` `Not started` Separate API and worker entrypoints cleanly so background jobs can run as an independent process/container with explicit startup and shutdown behavior.
- [ ] `P1` `Not started` Define retry, backoff, dead-letter, and alerting expectations for BullMQ email jobs instead of relying on default queue behavior.
- [ ] `P2` `Not started` Add operational checks around queue health, stuck jobs, and handler-level logging so email failures are diagnosable without code spelunking.

### 5. Testing And Quality Gates

Goal: make the repo safe to change by adding executable verification around critical auth flows.

- [ ] `P0` `Not started` Add a `typecheck` script and baseline test scripts to `package.json` so the project has first-class verification commands.
- [ ] `P0` `Not started` Introduce unit tests for `AuthService`, `SessionService`, and security-sensitive shared services with mocked external dependencies.
- [ ] `P0` `Not started` Add integration tests for signup, login, refresh, and email verification using real Prisma/Redis-backed flows where practical.
- [ ] `P0` `Not started` Cover the highest-risk cases first: token rotation, token reuse, duplicate signup, invalid credentials, and verification token expiry.
- [ ] `P1` `Not started` Add a minimum CI workflow that runs lint, typecheck, tests, and build on pull requests.
- [ ] `P1` `Not started` Define the minimum test data/setup strategy for Prisma and Redis so local and CI runs are reproducible.

### 6. Documentation And Operations

Goal: align repo documentation with the actual system boundary and make the project operable by another engineer.

- [ ] `P1` `Not started` Rewrite architecture and planning docs to distinguish clearly between implemented behavior and future-state goals.
- [ ] `P1` `Not started` Add a root `README.md` with local setup, required services, scripts, and a truthful implementation status summary.
- [ ] `P1` `Not started` Add a `.env.example` that reflects the current validated environment contract without shipping real secrets.
- [ ] `P2` `Not started` Keep deployment and infrastructure work tracked as future backlog items, but stop presenting them as if they already exist in-repo.
- [ ] `P2` `Not started` Add an observability backlog covering Sentry wiring, request IDs, metrics, and an incident runbook once the API surface is stable.

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
- Another engineer can use this file as the repo’s execution backlog without needing to reinterpret vague goals.
