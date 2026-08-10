# Relay

> Relay is a TypeScript identity and authentication backend API built on Express 5, Prisma (PostgreSQL), Redis, BullMQ, and React Email.

---

## What is this?

Relay is an enterprise-grade multi-tenant identity and authentication platform. It serves as a central authentication and authorization layer for modern web applications. Currently an active work-in-progress, it aims to provide a robust, production-ready solution for managing users, sessions, and asynchronous background tasks.

## Features

- **Core Auth API:** Signup, Login, Logout, Token Refresh (with rotation and reuse detection), Password Reset, Magic Links, OTP, and Email Verification.
- **Session Management:** Robust JWT issuance (RS256), explicit database-backed session revocation, and security middleware for authenticated routes and role enforcement.
- **Background Processing:** A dedicated BullMQ worker process handling transactional emails (via Resend) and periodic cleanup tasks, complete with custom backoff, dead-letter retention, and queue health monitoring.
- **Infrastructure Integrations:** PostgreSQL (via Prisma) and Redis with clean startup and graceful shutdown lifecycle management.

---

## Quick Start

### Prerequisites

- **Node.js** >= 22
- **PostgreSQL** 16 (for application state)
- **Redis** 7 (for session store, rate limiting, OTP cache, and BullMQ queues)
- **Resend API Key** (for transactional emails)
- **RSA Key Pair** (for JWT signing/verification)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd relay

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

_Note: Edit `.env` with your specific database connection strings and API keys._

### Database Setup

Apply the Prisma schema to your local PostgreSQL instance and generate the client:

```bash
npx prisma migrate dev
npx prisma generate
```

### Run

Relay uses separate entry points for the API and background workers. You must run both concurrently in local development.

```bash
# Terminal 1: Start the Express API server
npm run dev

# Terminal 2: Start the background worker
npm run dev:worker
```

App runs at `http://localhost:5000`

---

## Docker Setup (Alternative)

You can run the entire local development stack containerized using Docker Compose.

```bash
# Build and start all services (API, Worker, PostgreSQL, Redis)
docker compose -f infra/docker/docker-compose.yml up --build

# In a new terminal, apply database migrations to the running API container
docker compose -f infra/docker/docker-compose.yml run --rm api npx prisma migrate deploy
```

> **Recommended for Active Development:** Spin up PostgreSQL & Redis via Docker (`docker compose -f infra/docker/docker-compose.yml up postgres redis`), and run the Node.js API and Worker natively on your host machine to benefit from hot-reloads.

---

## Configuration

The application is configured via environment variables. Key variables include:

| Variable          | Required | Default | Description                                  |
| ----------------- | -------- | ------- | -------------------------------------------- |
| `DATABASE_URL`    | Yes      | —       | PostgreSQL connection string                 |
| `REDIS_URL`       | No       | —       | Redis connection string                      |
| `JWT_PRIVATE_KEY` | Yes      | —       | RSA Private Key for signing JWTs             |
| `JWT_PUBLIC_KEY`  | Yes      | —       | RSA Public Key for verifying JWTs            |
| `RESEND_API_KEY`  | Yes      | —       | API key for sending emails via Resend        |
| `PORT`            | No       | 5000    | API Server port                              |
| `LOG_LEVEL`       | No       | info    | Logging verbosity (debug, info, warn, error) |

---

## Running Tests

Relay uses Jest for testing. Unit tests run in isolation, while integration tests require a running database and Redis instance.

```bash
npm run test                   # Run unit tests
npm run test:integration       # Run end-to-end integration tests
```

---

## Scripts

| Script                           | Description                                               |
| -------------------------------- | --------------------------------------------------------- |
| `npm run dev`                    | Starts the Express API server in watch mode               |
| `npm run dev:worker`             | Starts the BullMQ background worker process in watch mode |
| `npm run build`                  | Compiles TypeScript source to `dist/`                     |
| `npm run start`                  | Runs the compiled API server (`dist/server.js`)           |
| `npm run start:worker`           | Runs the compiled worker process (`dist/worker.js`)       |
| `npm run typecheck`              | Verifies typings without emitting files                   |
| `npm run lint`                   | Runs ESLint over the codebase                             |
| `npm run format`                 | Runs Prettier formatting                                  |
| `npm run script:send-demo-email` | Utility to test outbound email configurations             |

---

## Project Structure

```text
src/
  config/       - Environment parsing, db singletons
  modules/      - Domain modules (auth, users, sessions, admin)
  shared/       - Cross-cutting concerns (middleware, utils, error handling)
  workers/      - BullMQ background jobs
  emails/       - React Email templates
  server.ts     - API entry point
  worker.ts     - Worker entry point
tests/          - Test helpers and E2E suites
docs/           - Architecture docs, concepts, runbooks, and how-tos
```

---

## Documentation

Comprehensive documentation is available in the repository:

- [System Architecture](ARCHITECTURE.md)
- [Context & Glossary](CONTEXT.md)
- [How-To Guides](docs/how-tos/)
- [Incident Runbooks](docs/runbooks/)
- [Architecture Decision Records (ADRs)](docs/adr/)
- [Concepts & Deep-Dives](docs/concepts/)
- [Development TODO list](TODO.md)

---

## Contributing

This repository is actively developed. Please refer to `TODO.md` for the comprehensive engineering backlog and roadmap. Pull requests should include corresponding tests and pass `npm run lint` and `npm run typecheck`.

---

## License

ISC — see the `package.json` for details.
