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

## Docker Setup

You can run the entire local development stack (API, Worker, PostgreSQL, and Redis) containerized using Docker and Docker Compose.

### Prerequisites

1. Ensure [Docker](https://www.docker.com/) and Docker Compose are installed and running.
2. Initialize your local environment file (Docker Compose will load these environment variables):
   ```bash
   cp .env.example .env
   ```

### 1. Build and Start the Stack

Run the following command from the repository root:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

This will build the API and worker images, pull infrastructure images, and spin up four services:
- **postgres**: PostgreSQL database mapped to port `5432` on localhost.
- **redis**: Redis instance mapped to port `6379` on localhost.
- **api**: Express 5 HTTP API server running at `http://localhost:5000`.
- **worker**: BullMQ background email worker process.

### 2. Apply Database Migrations

Before using the application, apply the database schema migrations inside the running API container:

```bash
docker compose -f infra/docker/docker-compose.yml run --rm api npx prisma migrate deploy
```

### 3. Alternative Workflow: Docker Infra + Native App (Recommended for Active Development)

Rebuilding Docker images on every code change can slow down your inner loop. The recommended setup is to run the database and Redis services in Docker, but run the application processes natively on your host machine to benefit from `tsx watch` hot-reloads:

1. **Spin up PostgreSQL & Redis only:**
   ```bash
   docker compose -f infra/docker/docker-compose.yml up postgres redis
   ```
2. **Apply migrations and start the API server:**
   ```bash
   npx prisma migrate dev
   npm run dev
   ```
3. **Start the background worker:**
   ```bash
   npm run dev:worker
   ```

> [!NOTE]
> For this workflow, make sure your `.env` contains `DATABASE_URL=postgresql://relay:relay@localhost:5432/relay_dev` and `REDIS_URL=redis://localhost:6379`. The Docker Compose file overrides these environment variables to use container hostnames (`postgres` and `redis`) *only* inside the containerized API and worker services.

For advanced commands, custom configurations, production image build guidelines, and AWS-ready secrets patterns, refer to the [Docker Design & Operations Guide](file:///e:/projects/relay/docs/docker.md).

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
