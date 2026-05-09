# TODO

## Tasks

#### REPO

| ID      | PRIORITY | STATUS | Summary                                                                         |
| ------- | -------- | ------ | ------------------------------------------------------------------------------- |
| REPO-06 | P1       | Done   | Fix stale typo-named files in dist output                                       |
| REPO-05 | P1       | Done   | Document dist/ policy and clean stale build artifacts                           |
| REPO-04 | P1       | Done   | Rewrite docs and prompts that still reference the old product name              |
| REPO-03 | P0       | Done   | Update JWT issuer/audience identifiers to remove legacy product naming          |
| REPO-02 | P0       | Done   | Rename stale legacy references in env config, email templates, and auth strings |
| REPO-01 | P0       | Done   | Adopt Relay as the canonical project name across source, docs, and email copy   |

#### AUTH

| ID      | PRIORITY | STATUS | Summary                                                                   |
| ------- | -------- | ------ | ------------------------------------------------------------------------- |
| AUTH-08 | P1       | Done   | Document cookie and token behavior per endpoint in docs/auth-contract.md  |
| AUTH-07 | P0       | Done   | Complete request validation schemas and unify controller error responses  |
| AUTH-06 | P1       | Done   | Add OTP request and verify endpoints with attempt bounding and expiry     |
| AUTH-05 | P1       | Done   | Add magic-link request and callback endpoints                             |
| AUTH-04 | P0       | Done   | Add password reset request and confirm endpoints with audit logging       |
| AUTH-03 | P0       | Done   | Add email verification callback and resend-verification endpoints         |
| AUTH-02 | P0       | Done   | Add logout and refresh endpoints with cookie handling and token rotation  |
| AUTH-01 | P0       | Done   | Finish route and controller coverage so login is exposed alongside signup |

#### SEC

| ID     | PRIORITY | STATUS | Summary                                                                       |
| ------ | -------- | ------ | ----------------------------------------------------------------------------- |
| SEC-06 | P1       | Done   | Complete graceful shutdown: disconnect Prisma, Redis, queues, and workers     |
| SEC-05 | P1       | Done   | Add CSRF and rate-limiting behavior for auth endpoints                        |
| SEC-04 | P1       | Done   | Add middleware for identity extraction, auth protection, and role enforcement |
| SEC-03 | P0       | Done   | Add session list and revoke APIs                                              |
| SEC-02 | P0       | Done   | Finish refresh-token rotation and reuse-detection with audit trails           |
| SEC-01 | P0       | Done   | Enforce email-verification policy during login and privileged auth flows      |

#### EMAIL

| ID       | PRIORITY | STATUS | Summary                                                            |
| -------- | -------- | ------ | ------------------------------------------------------------------ |
| EMAIL-04 | P1       | Done   | Define retry, backoff, dead-letter, and alerting config for BullMQ |
| EMAIL-03 | P1       | Done   | Separate API and worker entrypoints into independent processes     |
| EMAIL-02 | P1       | Done   | Verify all email flows are present and wired end-to-end            |
| EMAIL-01 | P1       | Done   | Upgrade React Email templates to production quality                |

#### TEST

| ID      | PRIORITY | STATUS | Summary                                                                   |
| ------- | -------- | ------ | ------------------------------------------------------------------------- |
| TEST-02 | P0       | Done   | Add unit tests for AuthService, SessionService, UserService, AdminService |
| TEST-01 | P0       | Done   | Add typecheck and test scripts to package.json                            |

#### DOCS

| ID      | PRIORITY | STATUS | Summary                                                                |
| ------- | -------- | ------ | ---------------------------------------------------------------------- |
| DOCS-03 | P1       | Done   | Add .env.example reflecting the current validated environment contract |
| DOCS-01 | P1       | Done   | Rewrite architecture docs to separate implemented vs future-state      |

---

## Milestones

### Phase 1 — Stabilize Core Auth MVP ✅

- Expose all core auth endpoints beyond signup.
- Finish session rotation/reuse protection and make email verification policy explicit.
- Add typecheck, unit tests, and core integration tests for auth flows.
- Remove stale legacy naming from runtime and user-facing behavior.

### Phase 2 — Harden Operations And Delivery ✅

- Separate worker and API process boundaries cleanly.
- Finish graceful shutdown and queue operational behavior.
- Rewrite docs so current-state and future-state are clearly separated.

### Phase 3 — Testing And CI 🔄 In progress

- Add integration and edge-case tests for all critical auth flows.
- Add CI workflow and reproducible local/test setup.

### Phase 4 — Expand Product Surface

- Add observability: Sentry, request IDs, structured logging, metrics.
- Add admin capabilities and broader platform features.
- Add deployment and infrastructure documentation once the service contract is stable.
