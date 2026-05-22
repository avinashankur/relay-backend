# Docker: Multi-Stage Builds & Local Development

> **Status**: Design guide — `Dockerfile`, `Dockerfile.worker`, and `docker-compose.yml` are **not yet created** in the repo.
> This document describes the intended layout and usage. See `TODO.md [DOCS-06]`.

---

## Overview

Relay runs two distinct processes:

| Process  | Entrypoint                         | Role                                       |
| -------- | ---------------------------------- | ------------------------------------------ |
| `api`    | `src/server.ts` → `dist/server.js` | HTTP server — Express 5 + all auth routes  |
| `worker` | `src/worker.ts` → `dist/worker.js` | BullMQ worker — email queue + cleanup cron |

Both share the same codebase, the same TypeScript build, and the same set of environment variables. The only difference is which entrypoint `node` runs. The Docker setup reflects this split: one base build image, two lean runtime images.

---

## Planned File Layout

```
relay/
└── infra/
    └── docker/
        ├── Dockerfile          # API image (multi-stage: deps → build → runtime)
        ├── Dockerfile.worker   # Worker image (shares the build stage)
        └── docker-compose.yml  # Local dev stack: postgres + redis + api + worker
```

Place the files under `infra/docker/` to separate infrastructure concerns from application source. When building from the repo root, pass the context explicitly:

```bash
docker build -f infra/docker/Dockerfile .
```

---

## Multi-Stage Build Strategy

### Why Multi-Stage?

The production image only needs the compiled `dist/` output and `node_modules` with `--omit=dev`. Multi-stage builds keep build tools (TypeScript compiler, `tsx`, etc.) out of the final image, reducing its attack surface and size.

### Stage 1 — `deps`: Install All Dependencies

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app

# Copy manifests only — layer-cached until package files change
COPY package.json package-lock.json ./
RUN npm ci
```

This stage produces a complete `node_modules` (including dev deps) needed for the TypeScript compile step.

### Stage 2 — `builder`: Compile TypeScript

```dockerfile
FROM deps AS builder
WORKDIR /app

# Copy full source
COPY . .

# Run the same build script used locally
RUN npm run build
# Output: dist/server.js, dist/worker.js, dist/**
```

`npm run build` runs `tsc && tsc-alias -f -fe .js` per `package.json`. The resulting `dist/` is the only artifact carried forward.

### Stage 3 — `runtime` (API image)

```dockerfile
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Production-only node_modules
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy Prisma schema — required at runtime for migrations check
COPY prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/server.js"]
```

### Worker Image (`Dockerfile.worker`)

Identical to the runtime stage except for the final `CMD`:

```dockerfile
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

# No port exposure — worker is not HTTP-facing
CMD ["node", "dist/worker.js"]
```

Because the worker image imports from the same `builder` stage, a single `docker buildx bake` or `docker compose build` compiles TypeScript once and reuses the output for both images.

---

## Prisma at Runtime

The Prisma client is generated into `src/generated/prisma/` at build time (`prisma generate` runs as part of `npm ci` via the `postinstall` hook, or must be run explicitly before `npm run build`).

> **Important**: Prisma schema and generated client must be consistent. The recommended pattern is:
>
> ```dockerfile
> # In the builder stage, after npm ci:
> RUN npx prisma generate
> RUN npm run build
> ```

Migrations are **not** run inside the container at startup. Run them as a separate step in your deployment pipeline before updating the API container:

```bash
npx prisma migrate deploy
```

---

## `docker-compose.yml` — Local Development Stack

The compose file brings up all four services needed for a complete local environment:

```yaml
# infra/docker/docker-compose.yml

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: relay
      POSTGRES_PASSWORD: relay
      POSTGRES_DB: relay_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U relay"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ../.. # repo root
      dockerfile: infra/docker/Dockerfile
    env_file: ../../.env
    environment:
      DATABASE_URL: postgresql://relay:relay@postgres:5432/relay_dev
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: ../..
      dockerfile: infra/docker/Dockerfile.worker
    env_file: ../../.env
    environment:
      DATABASE_URL: postgresql://relay:relay@postgres:5432/relay_dev
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
```

### Key Design Decisions

| Decision                                  | Rationale                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres:16-alpine` and `redis:7-alpine` | Match the versions used in production Terraform config (`docs/terraform-aws-infra.md`)                                                                              |
| `healthcheck` on both infra services      | Prevents the API and worker from starting before the database and cache are accepting connections                                                                   |
| `env_file: ../../.env`                    | Reuses the standard local `.env` from the repo root; service-level `environment` overrides the connection URLs to point at the compose network instead of localhost |
| No volume mount for source code           | The API and worker images use the compiled `dist/`; for hot-reload in dev use `npm run dev` directly without Docker                                                 |

---

## Common Commands

### Start the full local stack

```bash
# From repo root
docker compose -f infra/docker/docker-compose.yml up --build
```

### Start only infrastructure (postgres + redis), run the app natively

This is the recommended inner-loop workflow since it gives you `tsx watch` hot-reload:

```bash
# Terminal 1 — infra only
docker compose -f infra/docker/docker-compose.yml up postgres redis

# Terminal 2 — API with hot reload
npm run dev

# Terminal 3 — Worker with hot reload
npm run dev:worker
```

### Run database migrations inside compose

```bash
docker compose -f infra/docker/docker-compose.yml run --rm api \
  npx prisma migrate deploy
```

### Tear down (preserve data)

```bash
docker compose -f infra/docker/docker-compose.yml down
```

### Tear down and wipe all data

```bash
docker compose -f infra/docker/docker-compose.yml down -v
```

### Build and push images manually

```bash
# Build both images
docker build -f infra/docker/Dockerfile -t relay-api:local .
docker build -f infra/docker/Dockerfile.worker -t relay-worker:local .

# Tag and push to a registry (replace with your ECR/Docker Hub URL)
docker tag relay-api:local <registry>/relay-api:<tag>
docker push <registry>/relay-api:<tag>
```

---

## Environment Variables in Docker

All required variables are documented in [`.env.example`](../.env.example). When running under compose, the `DATABASE_URL` and `REDIS_URL` in the service-level `environment` block override anything in `.env`, pointing connections at the compose service names (`postgres`, `redis`) instead of `localhost`.

**Variables you must set explicitly for production images** (do not rely on `.env` files in production):

| Variable          | Notes                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | Postgres connection string; use a connection pooler (e.g., PgBouncer, Neon pooled URL) in production |
| `REDIS_URL`       | Redis/ElastiCache URL                                                                                |
| `JWT_PRIVATE_KEY` | RS256 private key — load from AWS Secrets Manager; do not bake into image                            |
| `JWT_PUBLIC_KEY`  | RS256 public key                                                                                     |
| `RESEND_API_KEY`  | Resend API key                                                                                       |
| `NODE_ENV`        | Must be `production`                                                                                 |

---

## Image Size Targets

Once built, the runtime images should be well under 300 MB using `node:22-alpine` as the base. The `node_modules` with `--omit=dev` is typically the dominant contributor (~150–200 MB for this dependency set).

To inspect image layers:

```bash
docker image history relay-api:local
```

---

## Integration with CI/CD

See [`docs/git-cicd-workflow.md`](./git-cicd-workflow.md) for the full pipeline guide. The Docker steps fit into the pipeline as follows:

```
lint + typecheck → unit tests → integration tests → docker build → push to ECR → deploy
```

The `docker build` step in CI should use `--cache-from` pointing at the previous image in the registry to avoid re-installing `node_modules` on every run:

```bash
docker build \
  --cache-from <registry>/relay-api:latest \
  --tag <registry>/relay-api:$GIT_SHA \
  -f infra/docker/Dockerfile .
```

---

## See Also

- [`.env.example`](../.env.example) — full environment variable reference
- [`docs/architecture.md`](./architecture.md) — repo structure and target directory layout
- [`docs/terraform-aws-infra.md`](./terraform-aws-infra.md) — AWS infrastructure design (ECS, RDS, ElastiCache)
- [`docs/git-cicd-workflow.md`](./git-cicd-workflow.md) — CI/CD pipeline guide
- `TODO.md [DOCS-06]` — task tracking this deliverable
