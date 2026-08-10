# Git Workflow & CI/CD Pipeline Guide

## Table of Contents

1. [Why CI/CD Exists](#1-why-cicd-exists)
2. [Git Fundamentals — the building block](#2-git-fundamentals--the-building-block)
3. [Branching Strategy](#3-branching-strategy)
4. [The Local Safety Net — Husky & lint-staged](#4-the-local-safety-net--husky--lint-staged)
5. [Pull Requests — the gate between branches](#5-pull-requests--the-gate-between-branches)
6. [What is CI (Continuous Integration)?](#6-what-is-ci-continuous-integration)
7. [What is CD (Continuous Deployment/Delivery)?](#7-what-is-cd-continuous-deploymentdelivery)
8. [GitHub Actions — the CI/CD engine](#8-github-actions--the-cicd-engine)
9. [A Typical Pipeline in Detail](#9-a-typical-pipeline-in-detail)
10. [Environment Promotion — dev → staging → prod](#10-environment-promotion--dev--staging--prod)
11. [Secrets & Environment Variables in CI](#11-secrets--environment-variables-in-ci)
12. [Rolling Back a Bad Deployment](#12-rolling-back-a-bad-deployment)
13. [The Full Developer Loop — end to end](#13-the-full-developer-loop--end-to-end)
14. [Current State & What to Build Next](#14-current-state--what-to-build-next)

---

## 1. Why CI/CD Exists

Imagine a team of five engineers all changing the same codebase at once. Without
any automated checks, the only way to know if the combined code still works is
for a human to manually:

- run the tests,
- check the types,
- lint the style,
- build the binary, and
- deploy it somewhere and click through the app.

That takes 20–60 minutes per change, humans forget steps, and by the time ten
pull requests are open the cost is unbearable.

**CI (Continuous Integration)** automates the "does it still work?" question
every time code is pushed. **CD (Continuous Deployment)** automates the "can we
put it in front of users?" question after CI passes.

Together they let the team ship ten times a day instead of once a week — and
catch regressions in minutes instead of days.

---

## 2. Git Fundamentals — the building block

### 2.1 What is a commit?

A commit is a **snapshot** of every file in the repository at a specific moment.
It carries:

- A **SHA hash** — a unique 40-character fingerprint (e.g. `a3f9c12…`).
- A **parent hash** — which commit came before it. This forms a chain (a DAG).
- The **author**, **timestamp**, and a **message** describing what changed.

```
A ← B ← C ← D   (each letter is a commit, arrows point to parent)
                  D is the latest commit on this chain
```

### 2.2 What is a branch?

A branch is simply a **named pointer** to one commit. When you create a branch
and make a new commit, the pointer advances. The underlying commit chain never
changes — branches are just labels on top of it.

```
main:  A ← B ← C
                ↑ main points here

feat/login: A ← B ← C ← D ← E
                              ↑ feat/login points here
```

`main` and `feat/login` share history (A, B, C) but `feat/login` has two extra
commits (D, E) that `main` has never seen.

### 2.3 What is a remote?

Your local machine has a copy of the entire repository. GitHub hosts another
copy called the **remote** (conventionally named `origin`). Commands:

| Command                      | What it does                                                 |
| ---------------------------- | ------------------------------------------------------------ |
| `git push origin feat/login` | Upload your local branch to GitHub                           |
| `git pull origin main`       | Download changes from GitHub's `main` into your local branch |
| `git fetch origin`           | Download metadata about all remote branches without merging  |

### 2.4 Merge vs. rebase

**Merge** combines two branches by creating a new "merge commit" that has two
parents.

```
main:       A ← B ← C ←──────── M   (M is the merge commit)
                    ↘           ↗
feat/login:          D ← E ←──
```

**Rebase** replays your branch's commits on top of the current tip of the target
branch. The history stays linear but commit SHAs change (they are rewritten).

```
After rebase of feat/login onto main:
main:       A ← B ← C ← D' ← E'
                         (D and E replayed with new SHAs)
```

> **Rule of thumb:** use **merge** (via pull requests on GitHub) for
> integrating feature branches into `main`. Rebase is fine locally to keep your
> branch clean before opening a PR.

---

## 3. Branching Strategy

A typical project follows a simplified **GitHub Flow**:

```
main  ──────────────────────────────────────────────────────►
        ↑ always production-ready
        │
        ├── feat/redis-init        (feature branch, 1–3 days)
        ├── feat/email-verification
        ├── fix/token-cookie-name  (bug fix branch)
        └── chore/update-deps      (maintenance branch)
```

### Rules

| Rule                                                          | Reason                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `main` is protected — no direct pushes                        | Prevents accidental breakage of the production-ready branch      |
| Every change enters via a pull request                        | Enables CI checks and code review before merge                   |
| Branch names carry intent: `feat/`, `fix/`, `chore/`, `docs/` | Makes the git log scannable without reading every commit message |
| Delete branches after merge                                   | Prevents branch graveyard clutter                                |

### Creating a branch (real command)

```bash
# Make sure you're up to date
git checkout main
git pull origin main

# Create and switch to your new branch
git checkout -b feat/otp-verify

# Do your work, then stage and commit
git add src/modules/auth/strategies/otp.strategy.ts
git commit -m "feat: add OTP verification with bounded attempt counter"

# Push to GitHub (first time needs -u to set upstream)
git push -u origin feat/otp-verify
```

---

## 4. The Local Safety Net — Husky & lint-staged

Before your code ever reaches GitHub, a project should have layers of local enforcement.

### 4.1 Husky — git hooks made easy

A **git hook** is a shell script that Git runs automatically at a specific
moment in the git workflow (e.g. just before `git commit` runs). Husky makes
managing these hooks easy and keeps them in version control so every developer
gets them automatically.

The hook typically lives at `.husky/pre-commit`:

```sh
npm test
npx lint-staged
npm run build
```

Every time you run `git commit`, Git executes this script first. If any command
exits with a non-zero code, the commit is **rejected** — your terminal shows the
error and no commit is created.

This means:

- A failing unit test blocks the commit at your desk, not in CI.
- A type error blocks the commit before a teammate reviews the PR.
- A broken build is caught in 30 seconds, not 10 minutes.

### 4.2 lint-staged — only check what changed

Running ESLint and Prettier over the _entire_ codebase on every commit would be
too slow. `lint-staged` solves this by running the configured tools only over
**files that are staged** (added to the commit with `git add`).

Config in `package.json`:

```json
"lint-staged": {
  "*.{js,jsx,ts,tsx}": ["eslint", "prettier --write"],
  "*.{css,md,json}": ["prettier --write"]
}
```

This means:

- If you stage `src/modules/auth/auth.service.ts`, only _that file_ is linted.
- Prettier auto-fixes style issues before the commit lands (you see the fix in
  the resulting commit).

### 4.3 The full local gate sequence

```
git commit -m "feat: add OTP verify"
      │
      ▼
  [pre-commit hook fires]
      │
      ├─► npm test            ✓ unit tests pass
      ├─► npx lint-staged     ✓ ESLint clean, Prettier formatted
      └─► npm run build       ✓ TypeScript compiles
      │
      ▼
  Commit created  → SHA: a3f9c12
```

If any step fails, the commit is aborted. Fix the error, re-stage, and commit again.

---

## 5. Pull Requests — the gate between branches

A **Pull Request (PR)** is a proposal to merge one branch into another. On
GitHub it is a web interface that shows:

- The diff (every line added/removed).
- A comment thread for code review.
- A status panel showing whether CI checks passed or failed.

### 5.1 Opening a PR

After pushing your branch:

```
GitHub → your repo → "Compare & pull request" button
```

Or directly:

```
https://github.com/organization/project/compare/feat/otp-verify
```

### 5.2 What GitHub does next (the automation hooks in)

When a PR is opened (or when new commits are pushed to an open PR), GitHub
triggers any configured **GitHub Actions workflows**. The PR's status checks
panel shows each workflow's result:

```
✅ CI / lint          passed in 23s
✅ CI / typecheck     passed in 41s
✅ CI / unit tests    passed in 1m 14s
❌ CI / build         failed in 2m 01s   ← merge is blocked
```

### 5.3 Branch protection rules

On GitHub (`Settings → Branches → Branch protection rules` for `main`):

- **Require status checks to pass before merging** — the merge button is greyed
  out until all CI jobs are green.
- **Require at least 1 approving review** — another engineer must read and
  approve the diff.
- **Restrict who can push directly** — only CI bots and admins can bypass.

These rules mean `main` only ever receives code that:

1. Passes all automated checks.
2. Has been read by a human.

---

## 6. What is CI (Continuous Integration)?

CI is the practice of **automatically verifying every code change** as soon as
it is pushed to a shared repository. The word "continuous" means "every time,
not just before release".

A CI pipeline is a sequence of jobs. Each job runs a shell-like script on a
fresh virtual machine (called a **runner**) provided by GitHub.

### 6.1 What CI checks

Given typical `package.json` scripts, a complete CI pipeline would run:

| Step              | Command                    | Purpose                                                 |
| ----------------- | -------------------------- | ------------------------------------------------------- |
| Install           | `npm ci`                   | Reproducible install (uses lockfile, fails on mismatch) |
| Typecheck         | `npm run typecheck`        | TypeScript compiler verifies types with no output       |
| Lint              | `npm run lint`             | ESLint catches code quality issues                      |
| Format            | `npm run format`           | Prettier verifies formatting (doesn't auto-fix in CI)   |
| Unit tests        | `npm test`                 | Jest runs unit test suites                              |
| Integration tests | `npm run test:integration` | Jest runs against real Postgres + Redis                 |
| Build             | `npm run build`            | tsc compiles; fails if build is broken                  |

Each job runs in isolation. A failure in "Typecheck" does not prevent "Lint"
from also running (unless you configure it to), so you get the full picture of
what is broken in one CI run.

### 6.2 Why `npm ci` instead of `npm install`?

| `npm install`                      | `npm ci`                               |
| ---------------------------------- | -------------------------------------- |
| May update `package-lock.json`     | Fails if lock file is out of sync      |
| Installs from `package.json` range | Installs exact versions from lock file |
| Appropriate for development        | Designed for automated environments    |

In CI you always want deterministic, reproducible builds. `npm ci` guarantees
both by refusing to proceed if anything is ambiguous.

---

## 7. What is CD (Continuous Deployment/Delivery)?

After CI confirms the code works, CD automates the act of **delivering it to
an environment** — staging or production.

### 7.1 Continuous Delivery vs. Continuous Deployment

| Term                      | Meaning                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| **Continuous Delivery**   | Code is _ready_ to deploy automatically, but a human presses the button     |
| **Continuous Deployment** | Every green CI run _automatically_ deploys to production with no human step |

Most teams start with Continuous Delivery (a human approves the production
deploy) and move toward Continuous Deployment as confidence grows.

### 7.2 What a deploy step does at the infrastructure level

For a typical Node.js backend, the deploy pipeline typically:

1. **Builds a Docker image** — a self-contained snapshot of the app with all
   its dependencies baked in.
2. **Pushes the image** to a container registry (e.g. AWS ECR, Docker Hub).
3. **Runs database migrations** — `npx prisma migrate deploy` applies any
   pending schema changes to the live database before traffic switches.
4. **Replaces the running container** — the new image is spun up; the old one
   is stopped after health checks pass.
5. **Verifies health** — the pipeline pings `/health` until the new instance
   responds, or rolls back if it times out.

---

## 8. GitHub Actions — the CI/CD engine

GitHub Actions is GitHub's built-in automation system. It runs pipelines defined
as YAML files stored in `.github/workflows/`.

### 8.1 Core concepts

| Concept      | What it is                                                |
| ------------ | --------------------------------------------------------- |
| **Workflow** | A YAML file that defines the full pipeline                |
| **Event**    | The trigger (e.g. `push`, `pull_request`, `schedule`)     |
| **Job**      | A group of steps that run on the same runner (VM)         |
| **Step**     | A single shell command or a pre-built Action              |
| **Runner**   | A GitHub-hosted VM (Ubuntu, Windows, or macOS)            |
| **Action**   | A reusable, versioned plugin (e.g. `actions/checkout@v4`) |

### 8.2 Anatomy of a workflow file

```yaml
# .github/workflows/ci.yml

name: CI # human-readable name shown on GitHub

on: # events that trigger this workflow
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck: # job ID (used as the status check name)
    runs-on: ubuntu-latest # which runner to use

    steps:
      - uses: actions/checkout@v4 # clone the repo onto the runner
      - uses: actions/setup-node@v4 # install Node.js
        with:
          node-version: "22"
          cache: "npm" # cache node_modules across runs

      - run: npm ci # install deps (locked)
      - run: npm run typecheck # run the check
```

Each `run:` line is a shell command. Each `uses:` line references a reusable
Action from the GitHub Marketplace.

### 8.3 Jobs running in parallel vs. in sequence

By default all jobs in a workflow run in **parallel** (on separate VMs
simultaneously). You can make a job wait for another with `needs:`:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]

  test:
    runs-on: ubuntu-latest
    needs: lint # test only runs if lint passes
    steps: [...]

  deploy:
    runs-on: ubuntu-latest
    needs: [lint, test] # deploy only runs if both pass
    steps: [...]
```

---

## 9. A Typical Pipeline in Detail

Let's look at three typical workflows. Here is what each one
does and why it might be structured that way.

### 9.1 `ci.yml` — runs on every PR and push

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format # Prettier check (read-only in CI)
      - run: npm test # unit tests (no external services needed)
      - run: npm run build

  integration:
    runs-on: ubuntu-latest
    needs: quality # only run if the quick checks pass first

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: myuser
          POSTGRES_PASSWORD: mypassword
          POSTGRES_DB: mydb_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s

    env:
      DATABASE_URL: postgresql://myuser:mypassword@localhost:5432/mydb_test
      REDIS_URL: redis://localhost:6379
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci
      - run: npx prisma migrate deploy # apply schema to the test DB
      - run: npm run test:integration
```

**Key things to note:**

- The `services:` block spins up **real Docker containers** (Postgres 16, Redis 7)
  alongside the runner. GitHub manages them; they are destroyed when the job
  ends. This is how integration tests work in CI without needing a real server.
- `--health-*` options make the runner wait until the containers are actually
  accepting connections before the steps run.
- `npx prisma migrate deploy` applies all pending Prisma migrations to the
  fresh test database before the tests start.

### 9.2 `deploy-staging.yml` — runs on merge to `develop` (future)

```yaml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging # requires approval if configured in GitHub

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci
      - run: npm run build

      - name: Build Docker image
        run: docker build -t my-api:${{ github.sha }} -f infra/docker/Dockerfile .

      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker tag my-api:${{ github.sha }} $ECR_REGISTRY/my-api:${{ github.sha }}
          docker push $ECR_REGISTRY/my-api:${{ github.sha }}
        env:
          ECR_REGISTRY: ${{ secrets.ECR_REGISTRY }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Run DB migrations on staging
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster my-staging-cluster \
            --service my-api \
            --force-new-deployment
```

### 9.3 `deploy-prod.yml` — runs on merge to `main` (future)

Production is structurally identical to staging but:

- Uses `environment: production` which can require a **manual approval step**
  in GitHub before the deploy job runs.
- Points at production secrets and the production ECS cluster.
- May implement a **blue/green deployment** where traffic is shifted gradually
  rather than all at once.

---

## 10. Environment Promotion — dev → staging → prod

Code travels through a promotion chain before reaching users:

```
Local Machine
    │  git push
    ▼
GitHub (feat/... branch)
    │  PR opened → CI runs
    │  PR approved + CI green
    ▼
main branch  ──────────────────────────────► Production
    │                                            ▲
    │                                    CD pipeline runs
    │  (future: push to develop first)           │
    ▼                                            │
develop branch  ──────────────────────────► Staging
                         CD pipeline runs       │
                                            QA verifies
                                                │
                                        Manual promotion
                                         to production
```

### Why have staging at all?

Staging is a production-clone environment that is safe to break. It is where:

- QA tests before real users are affected.
- Database migrations are verified against production-like data.
- Integration with third-party services (Resend, OAuth providers) is tested with
  real API calls but no real customer data.

### What "production-like" means

| Resource | Local dev       | Staging            | Production      |
| -------- | --------------- | ------------------ | --------------- |
| Postgres | Docker / local  | Neon / RDS         | Neon / RDS      |
| Redis    | Docker / local  | ElastiCache        | ElastiCache     |
| Email    | Resend sandbox  | Resend staging key | Resend live key |
| JWT keys | Local generated | Secrets Manager    | Secrets Manager |
| Sentry   | Disabled        | Staging DSN        | Prod DSN        |

---

## 11. Secrets & Environment Variables in CI

The `.env` file contains sensitive values (database URLs, RSA private keys, API
keys). **These are never committed to the repository** — `.gitignore` excludes
`.env`.

In CI and CD, secrets are stored in **GitHub Secrets** (`Settings → Secrets and
variables → Actions`) and injected as environment variables at runtime.

### How it works in a workflow

```yaml
steps:
  - name: Run migrations
    run: npx prisma migrate deploy
    env:
      DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
      JWT_PRIVATE_KEY: ${{ secrets.JWT_PRIVATE_KEY }}
```

`${{ secrets.STAGING_DATABASE_URL }}` is replaced by GitHub at runtime with the
secret value. GitHub redacts these values from log output automatically — you
will never see a secret printed in a build log.

### What to store as a GitHub Secret

| Secret name             | What it holds                                    |
| ----------------------- | ------------------------------------------------ |
| `DATABASE_URL`          | Production Postgres connection string            |
| `STAGING_DATABASE_URL`  | Staging Postgres connection string               |
| `REDIS_URL`             | Production Redis URL                             |
| `JWT_PRIVATE_KEY`       | RSA private key for JWT signing (base64 encoded) |
| `JWT_PUBLIC_KEY`        | RSA public key                                   |
| `RESEND_API_KEY`        | Resend transactional email API key               |
| `SENTRY_DSN`            | Sentry project DSN                               |
| `AWS_ACCESS_KEY_ID`     | AWS credentials for ECR/ECS operations           |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials                                  |
| `ECR_REGISTRY`          | AWS ECR registry URL                             |

---

## 12. Rolling Back a Bad Deployment

Even with CI, bad code can reach production. The rollback procedure depends on
how the deploy was done.

### 12.1 Docker/ECS rollback

Because each deployment tags the image with the git SHA, you can redeploy a
previous image:

```bash
# Find the previous known-good SHA from git log
git log --oneline main | head -5
# a3f9c12 feat: OTP verify endpoint
# 91cc4ab fix: token cookie name
# 7e2d083 chore: update deps

# Re-deploy the previous image
aws ecs update-service \
  --cluster my-prod-cluster \
  --service my-api \
  --task-definition my-api:91cc4ab   # the previous SHA
```

### 12.2 Git revert

If the bad code was merged to `main`, create a revert commit rather than force-
pushing (which rewrites history on a shared branch):

```bash
git revert a3f9c12    # creates a new commit that undoes a3f9c12
git push origin main  # triggers the CD pipeline with the revert commit
```

### 12.3 Database migrations during rollback

Rollback becomes more complex when the bad deployment included a **database
migration**. Prisma migrations are forward-only by default. Best practice:

- Write migrations to be **backwards-compatible** with the previous version of
  the code (e.g. add a nullable column before making the code require it).
- If you must roll back a migration, write a new migration that reverses it
  rather than deleting the original.

---

## 13. The Full Developer Loop — end to end

Here is the complete lifecycle of a single feature — "add OTP verify endpoint":

```
1. git checkout main && git pull origin main
   └── Get latest code from GitHub

2. git checkout -b feat/otp-verify
   └── Create an isolated branch for this work

3. [code, code, code]
   └── Edit src/modules/auth/strategies/otp.strategy.ts, add tests

4. git add -p
   └── Interactively stage only the relevant changes

5. git commit -m "feat: add OTP verification with bounded attempt counter"
   │
   └── [pre-commit hook fires]
       ├── npm test           ← unit tests must pass
       ├── npx lint-staged    ← ESLint + Prettier on staged files
       └── npm run build      ← TypeScript must compile
       [commit is created only if all pass]

6. git push -u origin feat/otp-verify
   └── Upload branch to GitHub

7. [Open Pull Request on GitHub]
   └── Compare feat/otp-verify → main

8. [GitHub Actions CI runs automatically]
   ├── Job: quality (typecheck, lint, format, unit tests, build)
   └── Job: integration (Postgres + Redis containers, integration tests)
   [PR merge button locked until all checks pass]

9. [Code review]
   └── Teammate reads the diff, leaves comments, approves

10. [Merge PR] — squash or merge commit onto main
    └── Branch deleted

11. [GitHub Actions CD runs on main]
    └── Job: deploy-prod
        ├── npm run build
        ├── docker build + push to ECR
        ├── npx prisma migrate deploy (on prod DB)
        └── aws ecs update-service (rolling deploy)

12. [Health check passes → old containers drained → deployment complete]
    └── OTP verify is live in production
```

Total elapsed time from step 5 to step 12: typically 5–10 minutes on a small
Node.js backend.

---
