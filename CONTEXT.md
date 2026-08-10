# CONTEXT.md

> This file provides essential context for AI coding assistants and new contributors. It is intentionally dense — read fully before making changes.
> Last updated: 2026-08-09

---

## What this is

Relay is a B2B multi-tenant identity and authentication platform. It serves as the central authentication and authorization API layer for modern web applications, providing production-grade security, session management, background jobs, and robust observability.

---

## Glossary

- **Access Token**: Short-lived RS256 JWT, completely stateless and verified locally.
- **Refresh Token**: Long-lived opaque string, stored as a SHA-256 hash in the database. Rotated on every use.
- **Magic Link**: Email-delivered login link containing a short-lived token to authenticate without a password.
- **OTP**: One-Time Password sent via email. Hashed and rate-limited in Redis using attempt-locking (max 5 attempts per 10 mins).

---

## Tech Stack

| Layer     | Technology           | Version | Notes                                        |
| --------- | -------------------- | ------- | -------------------------------------------- |
| Language  | TypeScript           | 5.x     | Strict mode enabled                          |
| Runtime   | Node.js              | 22 LTS  |                                              |
| Framework | Express              | 5.x     |                                              |
| ORM       | Prisma               | 7.x     | Single source of truth for DB schema         |
| Database  | PostgreSQL           | 16      | Primary storage for users/sessions           |
| Cache     | Redis                | 7       | Used for rate-limits, session hashes, queues |
| Queue     | BullMQ               |         | Worker runs in a separate process/container  |
| Emails    | React Email + Resend |         | Transactional emails                         |
| Testing   | Jest                 |         | Isolated unit and integration tests          |

---

## Codebase Map

```text
src/
  server.ts     - API entrypoint
  worker.ts     - Background worker entrypoint
  config/       - Environment parsing and DB singletons
  modules/      - Domain modules (auth, users, sessions, orgs, admin)
    [module]/
      *.router.ts     - Route definitions
      *.controller.ts - Req/res handling
      *.service.ts    - Business logic (no HTTP direct)
      *.validators.ts - Zod input schemas
      __tests__/      - Colocated unit and integration tests
  shared/       - Cross-cutting concerns
    middleware/ - Auth, RBAC, error handling, rate limiting
    services/   - Shared services (JWT, Redis, Email)
    errors/     - Custom AppError classes
  workers/      - BullMQ worker definitions (email, cleanup)
  emails/       - React Email templates
prisma/
  schema.prisma - Database schema definition
docs/           - Architecture docs, concepts, and how-tos
```

Do not look for business logic in route handlers or controllers — it belongs in `*.service.ts`. Do not write raw SQL — use Prisma.

---

## Key Patterns

**Adding a new API endpoint:**

1. Define Zod input schemas in `*.validators.ts`.
2. Add route in `*.router.ts` following the existing pattern and attaching middlewares.
3. Handle request/response mapping in `*.controller.ts`.
4. Implement core business logic in `*.service.ts`.
5. Add unit and integration tests for the service.

**Error handling:**

- All errors must be instances of `AppError` or its derivatives (`AuthError`, `ForbiddenError`, `NotFoundError`, `ValidationError`).
- Never throw plain `Error` objects in services.
- The global error middleware formats the final JSON response envelope.

**Auth:**

- Protected routes use `requireAuth` middleware to enforce a valid session.
- RBAC is enforced via `requireRole('ADMIN')` middleware.
- Request parsing is done by `parseToken` (prefers `httpOnly` cookie, falls back to Bearer header).
- Authentication uses a hybrid pattern: stateless JWT access tokens + opaque refresh tokens for session revocation capability.

**Database:**

- Never run queries outside of the service layer.
- Use Prisma transactions for multi-step writes.

---

## Key Invariants

Things that must ALWAYS be true. Do not write code that violates these:

- **Response Envelope**: All API responses must follow the envelope format: `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`.
- **Stateless API**: The Express API process must remain stateless. All state goes to PostgreSQL or Redis.
- **Background Jobs**: Do not block the API thread. Send emails and heavy tasks to BullMQ.
- **Refresh Token Rotation**: Refresh tokens must be rotated on every use. Presenting an already-used refresh token must trigger the reuse-detection protocol (revoke all sessions).
- **Secrets Management**: No hardcoded secrets in code. Use `process.env` validated by `config/env.ts`.

---

## What NOT to do

- Do not add new npm packages without checking if the functionality already exists in the project.
- Do not use `console.log` — use a structured logger if available.
- Do not write mutations in GET endpoints.
- Do not bypass Zod validation for incoming request bodies.
- Do not generate HTML for emails manually — use React Email components in `src/emails/`.

---

## Development Workflow

```bash
npm install           # Install dependencies
npm run dev           # Start dev server (API)
npm run dev:worker    # Start dev server (Worker)
npm test              # Run tests
npm run lint          # ESLint check
npm run typecheck     # tsc --noEmit
```

For the recommended local setup, use Docker for infrastructure only:

```bash
docker compose -f infra/docker/docker-compose.yml up postgres redis
```

See `docs/how-tos/how-to-run-docker.md` for full instructions.

---

## TODO Maintenance Rules

When interacting with this codebase as an AI:

- Keep `TODO.md` updated with the latest changes in the project.
- Whenever you do some changes in the codebase, update the todo file.
- If a task is complete, mark it as done but **do not remove it**.
- Add new tasks to the beginning of the todo file (top priority for you to work on).
- Tasks carry a stable `PREFIX-NN` identifier. IDs are **never reused or renumbered**.
- Valid prefixes: `REPO`, `AUTH`, `SEC`, `EMAIL`, `TEST`, `DOCS`.
- The TODO file is the single source of truth for the project backlog.

---

## Gotchas

- The `id` on Prisma models is a `cuid` (string), not an auto-incrementing integer.
- The `refresh_token` stored in the database is a SHA-256 hash, while the client cookie holds the raw opaque string.
- Local development requires both `npm run dev` and `npm run dev:worker` running concurrently for emails to be sent.
