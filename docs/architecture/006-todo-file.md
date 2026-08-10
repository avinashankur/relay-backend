# Relay TODO Guidelines

This document outlines the conventions and processes for maintaining the project's backlog in `TODO.md`.

## Operating Principles

- **Single Source of Truth:** `TODO.md` is a living document that must be kept updated with the latest changes in the project.
- **Always Update:** Whenever you make changes in the codebase, update the todo file accordingly.
- **Never Delete:** If a task is complete, mark it as `Done` but do not remove it.
- **Capture Everything:** Any backlog items in the codebase should be noted down here.
- **Concise:** The todo file should not contain irrelevant information and should remain concise.
- **Placement:** Add new todos at the top of their respective workstream sections so they are highly visible.

## Project Snapshot

Relay is a TypeScript identity and authentication backend built on Express 5, Prisma/Postgres, Redis, BullMQ, and React Email. The repository implements a complete Core Auth MVP featuring signup, login, session management, token rotation, password reset, magic links, OTP, and cross-app SSO capabilities. It includes comprehensive middleware for identity and role enforcement, robust background email processing with operational monitoring, and a full suite of integration tests. The project also features separated API and worker entrypoints with graceful shutdown and structured environmental configuration.

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

Each task carries a stable `PREFIX-NN` identifier.

- **Stability:** IDs are **never reused or renumbered** — inserting or removing a task does not affect any other ID. New tasks always get the next unused number within their prefix.
- **Prefixes:** The prefix should be the first 4 letters of the workstream (e.g., `REPO`, `AUTH`). Once a prefix is created, it should not be changed or deleted later. Similar tasks should always be added under the same prefix. New prefixes can be created if needed.

| Prefix  | Workstream                    |
| ------- | ----------------------------- |
| `REPO`  | Product Naming & Repo Hygiene |
| `AUTH`  | Core Auth API Completion      |
| `SEC`   | Session & Security Hardening  |
| `EMAIL` | Email & Background Processing |
| `TEST`  | Testing & Quality Gates       |
| `DOCS`  | Documentation & Operations    |

For each task, include:

- `STATUS`: `Not started | In progress | Blocked | Done`
- `PRIORITY`: `P0 | P1 | P2`
- `ID`: `PREFIX-NN`
- A summary of the work

Cross-reference format in code comments: `See TODO.md [PREFIX-NN]`

## Current-State Gaps

- `package.json` has `test` and `typecheck` scripts, and core integration tests are implemented, but there are remaining gaps in testing high-risk auth flows (token rotation, reuse, etc.).
- The project lacks a fully-featured CI pipeline (e.g., `.github/workflows/`) for automated verification on pull requests.
- The local test data/setup strategy for Prisma and Redis is not fully defined to guarantee reproducible local and CI runs.
- Production deployment configurations, containerized multi-stage builds, and infrastructure-as-code (Terraform) are missing.
- Observability features like Sentry wiring, request IDs, metrics, and incident runbooks are pending.

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
