# Relay

Relay is a TypeScript identity and authentication backend API built on Express 5, Prisma (PostgreSQL), Redis, BullMQ, and React Email.

## Implementation Status

This repository is an active work-in-progress. It is **not** yet a fully deployable out-of-the-box solution, but rather an evolving authentication platform.

**What is currently implemented:**

- **Core Auth API:** Signup, Login, Logout, Token Refresh (with rotation and reuse detection), Password Reset, Magic Links, OTP, and Email Verification.
- **Session Management:** Robust JWT issuance, explicit database-backed session revocation, and security middleware for authenticated routes and role enforcement.
- **Background Processing:** A dedicated BullMQ worker process handling transactional emails (via Resend) and periodic cleanup tasks, complete with custom backoff, dead-letter retention, and queue health monitoring.
- **Infrastructure Integrations:** PostgreSQL (via Prisma) and Redis (via ioredis) with clean startup and graceful shutdown lifecycle management.
- **Unit Tests:** Coverage for core domain services (`AuthService`, `SessionService`, `UserService`, `AdminService`).

**What is pending/planned:**

- End-to-end integration tests backed by real databases.
- Automated CI pipelines (linting, typechecking, tests).
- Production deployment configurations and observability (Sentry, Datadog/metrics).
- Broader platform capabilities (webhooks, multi-tenant features).
  _See `TODO.md` for the comprehensive engineering backlog and roadmap._

## Required Services

To run Relay locally, you need the following external services available:

1. **PostgreSQL** (for application state)
2. **Redis** (for session store, rate limiting, OTP cache, and BullMQ queues)
3. **Resend API Key** (for transactional emails)
4. **RSA Key Pair** (for JWT signing/verification)

## Local Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy the example environment file and fill in your specific credentials.

   ```bash
   cp .env.example .env
   ```

3. **Database Setup:**
   Apply the Prisma schema to your local PostgreSQL instance and generate the client:

   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Start the applications:**
   Relay uses separate entry points for the API and background workers. You need to run both concurrently in local development.

   _In one terminal window (API):_

   ```bash
   npm run dev
   ```

   _In another terminal window (Worker):_

   ```bash
   npm run dev:worker
   ```

## Scripts

The following standard scripts are available:

| Script                           | Description                                               |
| -------------------------------- | --------------------------------------------------------- |
| `npm run dev`                    | Starts the Express API server in watch mode               |
| `npm run dev:worker`             | Starts the BullMQ background worker process in watch mode |
| `npm run build`                  | Compiles TypeScript source to `dist/`                     |
| `npm run start`                  | Runs the compiled API server (`dist/server.js`)           |
| `npm run start:worker`           | Runs the compiled worker process (`dist/worker.js`)       |
| `npm run typecheck`              | Verifies typings without emitting files                   |
| `npm run test`                   | Executes Jest unit test suites                            |
| `npm run lint`                   | Runs ESLint over the codebase                             |
| `npm run format`                 | Runs Prettier formatting                                  |
| `npm run script:send-demo-email` | Utility to test outbound email configurations             |
