# Enterprise-Grade Multi-Tenant Identity Platform - Build Specification

> **Note on Implementation Status**:
> This document serves as the **foundational planning specification** and **target-state build prompt** for the Relay project.
> It outlines the comprehensive vision for an enterprise-grade identity platform.
> **Important:** Many features described here (e.g., full OAuth, multi-org support, advanced infrastructure, full CI/CD) represent **future-state goals** rather than currently implemented behavior.
> For the truthful current implementation status, refer to `TODO.md` and the existing codebase.

## Project Overview

Build a production-ready, multi-tenant identity and authentication backend platform that serves as the central authentication and authorization layer for modern web applications. This is an **industry-standard, enterprise-grade system** that must demonstrate professional software engineering practices, security-first design, and production deployment readiness.

**Primary Objective**: Create a secure, scalable, maintainable identity platform that handles authentication, user management, session management, background jobs, and comprehensive observability through a versioned REST API.

---

## Core Principles & Standards

### 1. Production-Grade Quality

- Code must be production-ready, not a proof-of-concept or tutorial-level implementation
- Every component should follow industry best practices and security standards
- Architecture should support horizontal scaling and high availability
- Zero-downtime deployment capability is required

### 2. Security-First Design

- Implement defense-in-depth across all layers
- Follow OWASP Top 10 guidelines
- All security mechanisms must be industry-standard (no custom crypto, no novel auth patterns)
- Assume breach mentality: design for containment and detection

### 3. Operational Excellence

- Comprehensive observability from day one
- Detailed structured logging with correlation IDs
- Metrics, tracing, and error tracking integrated
- Runbooks and incident response documentation

### 4. Developer Experience

- Self-documenting code with comprehensive inline comments
- Complete API documentation (OpenAPI spec)
- Easy local development setup with Docker Compose
- Clear README files for every module
- Architecture Decision Records (ADRs) for key choices

---

## Technology Stack Requirements

### Runtime & Language

- **Choose ONE** modern backend runtime with strong typing:
  - Node.js (18+ LTS) with TypeScript 5.x in strict mode
  - Python 3.11+ with type hints and Pydantic
  - Go 1.21+ with full static typing
  - Java 17+ (Spring Boot) or Kotlin
  - .NET 8+ (C#)
  - Rust with Axum/Actix
- **Web Framework**: Select mature, production-proven framework:
  - Node: Express 5.x, Fastify, or NestJS
  - Python: FastAPI, Django, or Flask
  - Go: Echo, Gin, or Chi
  - Java: Spring Boot
  - .NET: ASP.NET Core
  - Rust: Axum or Actix-web

### Database Layer

- **Primary Database**: PostgreSQL 15+ (required for relational integrity)
  - Cloud options: AWS RDS, Google Cloud SQL, Azure Database, Neon, Supabase, or Railway
  - Must support connection pooling (PgBouncer or native pooler)
- **ORM/Query Builder**: Type-safe data access layer
  - Node: Prisma 5.x, TypeORM, or Drizzle
  - Python: SQLAlchemy 2.x or Tortoise ORM
  - Go: GORM, sqlc, or sqlx
  - Java: JPA/Hibernate or jOOQ
  - .NET: Entity Framework Core
  - Rust: Diesel or SeaORM

### Caching & Session Store

- **Redis 7+** for session storage, rate limiting, and temporary token storage
  - Cloud options: AWS ElastiCache, Google Memorystore, Azure Cache, Upstash, or Redis Cloud
  - Must use connection pooling and reconnection logic
  - Local dev: Docker Redis container

### Authentication & Security Stack

#### Password Hashing

- **bcrypt** (cost factor ≥ 12) OR **Argon2id** (preferred)
- Make algorithm configurable for future migration path

#### JWT Signing

- **RS256 (RSA asymmetric)** for access tokens (required)
- Key rotation support (keys from secure storage, 90-day rotation cycle)
- Libraries: jsonwebtoken + jose (Node), PyJWT (Python), golang-jwt (Go), etc.

#### OAuth 2.0 Implementation

- Support minimum: Google OAuth, GitHub OAuth
- Allow user to request additional providers: Microsoft, Apple, LinkedIn, etc.
- PKCE support for public clients
- Account linking with conflict resolution

#### Input Validation

- Schema-based validation at API boundary:
  - Node: Zod or Joi
  - Python: Pydantic
  - Go: validator or ozzo-validation
  - Java: Jakarta Bean Validation
  - .NET: FluentValidation
  - Rust: serde + validator

#### HTTP Security

- Security headers middleware (Helmet.js equivalent)
- CSRF protection (double-submit cookie pattern)
- Rate limiting (Redis-backed sliding window)
- CORS configuration with strict origin validation

### Email & Transactional Messaging

- **Email Provider** (choose one based on reliability and deliverability):
  - **Resend** (recommended for developer experience)
  - SendGrid
  - AWS SES
  - Postmark
  - Mailgun
- **Template Engine**: Component-based or template-based
  - Node: React Email or MJML
  - Python: Jinja2
  - Go: html/template
  - Others: Handlebars, Mustache, or native templating

**Email Types Required**:

1. Email verification
2. Magic link authentication
3. OTP (one-time password)
4. Password reset
5. Security alerts (token reuse, suspicious login)
6. Organization invitations (if multi-org implemented)

### Background Jobs & Queue System

- **Queue Technology** (choose one with robust retry/DLQ support):
  - Node: BullMQ (Redis-backed)
  - Python: Celery (Redis/RabbitMQ) or Dramatiq
  - Go: Asynq or Machinery
  - Java: Spring Batch or Quartz
  - .NET: Hangfire
  - Any: Temporal, Inngest, or Trigger.dev

- **Job Types**:
  - Email sending (high priority)
  - Session cleanup (daily cron)
  - Token expiration (daily cron)
  - Soft-deleted user cleanup (daily cron)
  - Audit log batch flushing

- **Worker Deployment**: Separate process/container from main API

### Infrastructure & Deployment

#### Containerization

- **Docker** with multi-stage builds
- Separate Dockerfiles for:
  - API service (optimized production image)
  - Worker service
  - Optional: admin dashboard
- Alpine-based or distroless final images for minimal attack surface

#### Cloud Compute Options (choose ONE):

- **VM-based**: AWS EC2, Google Compute Engine, Azure VMs, DigitalOcean Droplets
- **Container Orchestration**: ECS, Google Cloud Run, Azure Container Apps, or Kubernetes
- **Serverless**: AWS Lambda, Google Cloud Functions (requires architectural adjustments)

#### Load Balancing & TLS

- Application Load Balancer: AWS ALB, Google Cloud Load Balancing, Azure Load Balancer, or Nginx
- TLS termination at load balancer
- Health check endpoints: `/health` (liveness), `/health/ready` (readiness)

#### Infrastructure as Code

- **Choose ONE**:
  - Terraform (recommended for multi-cloud)
  - AWS CloudFormation / CDK
  - Pulumi
  - Google Cloud Deployment Manager
  - Azure Bicep / ARM Templates

**IaC Must Include**:

- VPC/Network configuration with public and private subnets
- Compute resources (VMs/containers)
- Load balancer configuration
- Database (RDS/managed Postgres)
- Cache (ElastiCache/managed Redis)
- Secrets management integration
- IAM roles and security groups
- DNS and SSL certificate management

#### Secrets Management

- **Never store secrets in code or env files**
- Use managed secret storage:
  - AWS Secrets Manager / Parameter Store
  - Google Secret Manager
  - Azure Key Vault
  - HashiCorp Vault
  - Doppler
  - Infisical

**Secrets to Manage**:

- Database credentials
- Redis connection string
- JWT signing private keys (RSA keypair)
- OAuth client secrets (per provider)
- Email API keys
- Third-party service credentials

### CI/CD Pipeline

#### Source Control

- Git with branch protection rules
- Require PR reviews before merge to main
- Enforce status checks (all tests must pass)

#### CI Pipeline (GitHub Actions, GitLab CI, or CircleCI)

**Required Stages**:

1. **Lint** → Code style enforcement
2. **Type Check** → Static type validation
3. **Unit Tests** → Fast, isolated tests (≥80% coverage target)
4. **Integration Tests** → API contract tests with real DB/Redis (Docker-based)
5. **Security Scan** → Dependency vulnerability scanning
6. **Build** → Docker image creation
7. **Push** → Container registry upload (on main branch only)
8. **Database Migration** → Separate job, runs before deployment
9. **Deploy** → Rolling or blue-green deployment
10. **Smoke Tests** → Post-deployment validation

#### Deployment Strategy

- **Staging**: Auto-deploy on push to `develop` branch
- **Production**: Auto-deploy on push to `main` branch (or manual approval)
- **Migration Pipeline**: Dry-run migrations in PR checks, apply before deployment
- **Rollback Plan**: Document rollback procedure, test in staging

### Observability Stack

**Choose ONE comprehensive observability solution**:

#### Option A: Open Source Stack (Recommended)

- **Error Tracking**: Sentry (or Rollbar, Bugsnag)
- **Structured Logging**: JSON logs with correlation IDs
  - Node: Pino
  - Python: structlog
  - Go: zerolog or zap
  - Java: Logback with JSON encoder
  - .NET: Serilog
- **Log Aggregation**:
  - Cloud: CloudWatch Logs, Google Cloud Logging, Azure Monitor
  - Self-hosted: ELK Stack (Elasticsearch, Logstash, Kibana) or Loki
- **Metrics**: Prometheus + Grafana
- **Tracing**: OpenTelemetry + Jaeger (or Zipkin)

#### Option B: Commercial Platform (Alternative)

- **Datadog** (all-in-one: logs, metrics, traces, APM)
- **New Relic** (all-in-one)
- **Honeycomb** (observability for distributed systems)

#### Option C: Hybrid

- **Sentry** for errors
- **Betterstack** (Logtail) for logs
- **Prometheus + Grafana Cloud** for metrics
- **OpenTelemetry + SigNoz** for tracing

**Required Observability Features**:

- Request ID (UUID) attached to every request
- User ID context in logs and error tracking
- Structured logging: JSON format with standard fields
- Key metrics dashboards (see Metrics section below)
- Distributed tracing across API ↔ DB ↔ Redis ↔ Worker
- Alert rules for critical thresholds
- Uptime monitoring with synthetic checks (UptimeRobot, Checkly, Pingdom)

### Testing Stack

#### Unit Testing

- Framework: Jest, pytest, Go testing, JUnit, xUnit, or cargo test
- Coverage target: **≥80% for business logic modules**
- Mock database and external services
- Fast execution (entire suite < 30 seconds)

#### Integration Testing

- Framework: Same as unit + HTTP client (Supertest, httpx, Go net/http/httptest)
- Real PostgreSQL (Docker container in CI)
- Real Redis (Docker container in CI)
- Test API contracts end-to-end
- Coverage: All happy paths + critical error paths

#### End-to-End (E2E) Testing

- Framework: Playwright, Cypress, or Selenium
- Browser-based flows:
  - Signup via OAuth
  - Magic link email flow
  - Session management (list, revoke)
  - Cookie behavior validation

#### Load/Performance Testing

- Tool: k6, Locust, JMeter, or Gatling
- Target: Auth endpoints p95 latency < 200ms
- Validate no degradation at 10x baseline traffic
- Test rate limiting effectiveness

#### Security Testing

- Dependency scanning: npm audit, Snyk, OWASP Dependency-Check, or Trivy
- CI gate: Block on high-severity vulnerabilities
- Optional: OWASP ZAP or Burp Suite scans

---

## System Architecture

### Architectural Pattern

**Modular Monolith** (required for MVP)

- Single deployable unit (Docker image)
- Domain modules with strict internal boundaries
- Clear separation of concerns
- Future extraction path to microservices if needed
- Workers deployed as separate container from API

### Module Structure

All code must be organized by domain with consistent internal structure:

```
src/
├── modules/           # Domain modules (self-contained)
│   ├── auth/
│   │   ├── *.router.*      # Route definitions
│   │   ├── *.controller.*  # Request/response handling
│   │   ├── *.service.*     # Business logic
│   │   ├── *.validators.*  # Input validation schemas
│   │   ├── *.types.*       # Module-scoped types
│   │   ├── strategies/     # Auth strategy implementations
│   │   └── __tests__/      # Unit + integration tests
│   ├── users/
│   ├── sessions/
│   ├── orgs/          # Optional: multi-org support
│   └── admin/
│
├── shared/            # Cross-cutting concerns
│   ├── middleware/    # Reusable middleware (auth, RBAC, rate limit, etc.)
│   ├── services/      # Shared services (JWT, Redis, Email, Crypto)
│   ├── validators/    # Common validation schemas
│   ├── errors/        # Custom error classes
│   └── utils/         # Helper functions
│
├── workers/           # Background job processors
│   ├── email/
│   ├── cleanup/
│   └── index.*        # Worker registration + graceful shutdown
│
├── config/            # Configuration management
│   ├── env.*          # Environment variable parsing + validation
│   ├── database.*     # DB client singleton
│   ├── redis.*        # Redis client singleton
│   └── observability.*
│
└── emails/            # Email templates
    ├── components/    # Reusable email components
    └── *.template.*   # Individual email templates
```

### Request Flow Architecture

```
Client (Browser/Next.js/Mobile)
  ↓
TLS Termination (Load Balancer)
  ↓
API Gateway / Reverse Proxy (optional Nginx)
  ↓
Express/FastAPI/Echo API
  ├── Middleware Chain:
  │   ├── Request ID injection
  │   ├── Logging
  │   ├── CORS
  │   ├── Security headers
  │   ├── Rate limiting (Redis)
  │   ├── CSRF validation
  │   ├── JWT parsing (optional)
  │   ├── Auth requirement (optional)
  │   ├── RBAC check (optional)
  │   └── Request validation (Zod/Pydantic)
  │
  ├── Domain Modules (Auth, Users, Sessions, Admin)
  │   ↓
  ├── PostgreSQL (Prisma/SQLAlchemy ORM)
  ├── Redis (sessions, tokens, rate limits)
  └── Job Queue (BullMQ/Celery) → Worker Process
        ↓
      Email Provider (Resend/SendGrid)
```

---

## Data Model

### Database Schema (Prisma-style, adapt to chosen ORM)

#### Users Table

```prisma
model User {
  id            String      @id @default(cuid())
  email         String      @unique
  emailVerified Boolean     @default(false)
  name          String?
  avatarUrl     String?
  role          UserRole    @default(USER)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  deletedAt     DateTime?   // soft delete

  authAccounts  AuthAccount[]
  sessions      Session[]
  auditEvents   AuditEvent[]
  memberships   OrgMembership[]  // if multi-org

  @@index([email])
}

enum UserRole {
  ADMIN
  USER
}
```

#### AuthAccount Table (supports multiple auth providers per user)

```prisma
model AuthAccount {
  id          String   @id @default(cuid())
  provider    String   // "password" | "google" | "github" | "microsoft" etc.
  providerId  String?  // provider-specific user ID (null for password)
  credential  String?  // bcrypt/argon2 hash (only for password provider)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@unique([provider, providerId])
  @@index([userId])
}
```

#### Session Table

```prisma
model Session {
  id               String   @id @default(cuid())
  userId           String
  refreshTokenHash String   // SHA-256 hash of raw refresh token
  deviceInfo       Json?    // { userAgent, device, os, browser, location }
  ip               String?
  lastSeenAt       DateTime @default(now())
  expiresAt        DateTime
  createdAt        DateTime @default(now())
  revokedAt        DateTime?

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([refreshTokenHash])
  @@index([userId])
  @@index([expiresAt])
}
```

#### AuditEvent Table

```prisma
model AuditEvent {
  id        String   @id @default(cuid())
  userId    String?
  action    String   // "auth.login", "auth.logout", "session.revoke", etc.
  metadata  Json?    // non-PII contextual data
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

#### Organization Tables (Optional - implement if requested or if capacity allows)

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships OrgMembership[]
  invites     OrgInvite[]
}

model OrgMembership {
  id        String   @id @default(cuid())
  userId    String
  orgId     String
  role      OrgRole  @default(MEMBER)
  createdAt DateTime @default(now())

  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
  @@index([orgId])
}

enum OrgRole {
  OWNER
  ADMIN
  MEMBER
}

model OrgInvite {
  id        String   @id @default(cuid())
  email     String
  orgId     String
  role      OrgRole  @default(MEMBER)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  acceptedAt DateTime?

  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([email])
  @@index([orgId])
}
```

### Index Strategy

- **User**: `email` (unique), `id` (primary)
- **AuthAccount**: `(provider, providerId)` (unique composite), `userId` (foreign key)
- **Session**: `refreshTokenHash` (lookup on refresh), `userId` (list user sessions), `expiresAt` (cleanup job)
- **AuditEvent**: `userId`, `action`, `createdAt` (filtering and exports)

---

## API Surface

**Base Path**: `/api/v1`

**Standard Response Envelope**:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "requestId": "req_..." }
}
```

### Authentication Endpoints

| Method | Path                             | Description                                  | Auth Required | Rate Limit        |
| ------ | -------------------------------- | -------------------------------------------- | ------------- | ----------------- |
| POST   | `/auth/signup`                   | Create account + send verification email     | No            | 10/hour per IP    |
| POST   | `/auth/login`                    | Password login → set cookies                 | No            | 5/min per IP      |
| POST   | `/auth/logout`                   | Invalidate refresh token, clear cookies      | Yes           | -                 |
| POST   | `/auth/refresh`                  | Rotate refresh token, issue new access token | Cookie        | -                 |
| POST   | `/auth/magic-link`               | Send magic link email                        | No            | 3/5min per email  |
| GET    | `/auth/magic-link/callback`      | Validate token, create session               | No            | -                 |
| POST   | `/auth/otp/request`              | Send OTP via email                           | No            | 5/10min per email |
| POST   | `/auth/otp/verify`               | Verify OTP, create session                   | No            | 5 attempts max    |
| GET    | `/auth/oauth/:provider`          | Redirect to OAuth provider                   | No            | -                 |
| GET    | `/auth/oauth/:provider/callback` | Handle OAuth callback                        | No            | -                 |
| POST   | `/auth/password-reset/request`   | Send password reset email                    | No            | 3/hour per email  |
| POST   | `/auth/password-reset`           | Apply new password using token               | No            | -                 |
| GET    | `/auth/verify-email`             | Verify email from inbox link                 | No            | -                 |
| POST   | `/auth/verify-email`             | Verify email with token                      | No            | -                 |

### User & Session Endpoints

| Method | Path            | Description                             | Auth Required |
| ------ | --------------- | --------------------------------------- | ------------- |
| GET    | `/me`           | Current user profile                    | Yes           |
| PATCH  | `/me`           | Update profile (name, avatar)           | Yes           |
| DELETE | `/me`           | Soft-delete account                     | Yes           |
| GET    | `/sessions`     | List active sessions                    | Yes           |
| DELETE | `/sessions/:id` | Revoke specific session                 | Yes           |
| DELETE | `/sessions`     | Revoke all sessions (logout everywhere) | Yes           |

### Admin Endpoints (RBAC-gated: require ADMIN role)

| Method | Path                         | Description                           | Auth Required |
| ------ | ---------------------------- | ------------------------------------- | ------------- |
| GET    | `/admin/users`               | List all users (paginated)            | Admin         |
| GET    | `/admin/users/:id`           | User details + sessions + audit log   | Admin         |
| PATCH  | `/admin/users/:id/role`      | Change user role                      | Admin         |
| POST   | `/admin/users/:id/suspend`   | Suspend user account                  | Admin         |
| POST   | `/admin/users/:id/unsuspend` | Unsuspend user account                | Admin         |
| GET    | `/admin/audit`               | Query audit log (filters, pagination) | Admin         |

### Organization Endpoints (Optional)

| Method | Path                               | Description         | Auth Required |
| ------ | ---------------------------------- | ------------------- | ------------- |
| POST   | `/orgs`                            | Create organization | Yes           |
| GET    | `/orgs/:slug`                      | Get org details     | Member        |
| PATCH  | `/orgs/:slug`                      | Update org          | Owner/Admin   |
| DELETE | `/orgs/:slug`                      | Delete org          | Owner         |
| GET    | `/orgs/:slug/members`              | List members        | Member        |
| POST   | `/orgs/:slug/invite`               | Send member invite  | Owner/Admin   |
| POST   | `/orgs/:slug/accept-invite`        | Accept invite       | Yes           |
| DELETE | `/orgs/:slug/members/:userId`      | Remove member       | Owner/Admin   |
| PATCH  | `/orgs/:slug/members/:userId/role` | Change member role  | Owner         |

### Health & Observability Endpoints

| Method | Path            | Description                               |
| ------ | --------------- | ----------------------------------------- |
| GET    | `/health`       | Liveness check (200 if process alive)     |
| GET    | `/health/ready` | Readiness check (DB + Redis connectivity) |
| GET    | `/metrics`      | Prometheus metrics endpoint               |
| GET    | `/openapi.json` | OpenAPI 3.1 specification                 |

---

## Security Implementation

### Token Strategy

| Token Type             | Algorithm       | TTL        | Storage              | Notes                              |
| ---------------------- | --------------- | ---------- | -------------------- | ---------------------------------- |
| **Access Token**       | JWT RS256       | 15 minutes | HttpOnly cookie      | Short TTL limits breach impact     |
| **Refresh Token**      | Opaque (CSPRNG) | 30 days    | Hashed in Redis + DB | Rotated on every use               |
| **Magic Link Token**   | CSPRNG hex      | 15 minutes | Hashed in Redis      | Single-use, deleted on consumption |
| **OTP Code**           | 6-digit numeric | 10 minutes | Hashed in Redis      | Max 5 attempts, locked on breach   |
| **Password Reset**     | CSPRNG hex      | 30 minutes | Hashed in Redis      | Single-use, invalidated on use     |
| **Email Verify Token** | CSPRNG hex      | 24 hours   | Hashed in Redis      | Single-use                         |

### Refresh Token Rotation & Reuse Detection

**Critical Security Feature - Must Implement**

Every call to `POST /auth/refresh` must:

1. Consume the current refresh token (invalidate immediately)
2. Issue a brand-new refresh token
3. Update the hash in Redis and database

**Reuse Detection Logic**:

```
IF refresh token presented twice (after already rotated):
  1. Detect: Token hash not found in Redis but exists in DB with rotatedAt timestamp
  2. React: Revoke ALL active sessions for the user
  3. Audit: Log "auth.token_reuse_detected" event
  4. Alert: Enqueue security email to user
  5. Response: Return 401 Unauthorized
```

### Cookie Configuration

```http
Set-Cookie: access_token=<jwt>;
  HttpOnly; Secure; SameSite=Strict;
  Path=/; Max-Age=900

Set-Cookie: refresh_token=<opaque>;
  HttpOnly; Secure; SameSite=Strict;
  Path=/api/v1/auth/refresh;
  Max-Age=2592000
```

### Rate Limiting Strategy

| Endpoint Group                      | Limit         | Window               | Behavior on Breach                 |
| ----------------------------------- | ------------- | -------------------- | ---------------------------------- |
| `POST /auth/login`                  | 5 attempts    | per IP per minute    | HTTP 429 + Retry-After header      |
| `POST /auth/otp/*`                  | 5 attempts    | per email per 10 min | Lock OTP, require re-request       |
| `POST /auth/magic-link`             | 3 requests    | per email per 5 min  | HTTP 429                           |
| `POST /auth/signup`                 | 10 requests   | per IP per hour      | HTTP 429                           |
| `POST /auth/password-reset/request` | 3 requests    | per email per hour   | Always return 200 (no enumeration) |
| Global API                          | 1000 requests | per IP per minute    | HTTP 429                           |

**Implementation**: Redis-backed sliding window algorithm

### Password Security

- **Minimum Requirements** (enforce via validation):
  - Length: ≥ 12 characters
  - Complexity: At least 3 of 4 (uppercase, lowercase, numbers, special chars)
  - Check against common password lists (e.g., top 10k breached passwords)
- **Hashing**:
  - bcrypt with cost factor ≥ 12 (configurable)
  - OR Argon2id (recommended)
  - Make algorithm configurable for future migration

### Secrets Management

- **Store in Secrets Manager**: DB credentials, JWT keys, OAuth secrets, API keys
- **JWT Key Rotation**: Every 90 days (automated job)
  - Keep old keys for verification during grace period (7 days overlap)
  - Use kid (key ID) in JWT header
- **OAuth Secrets**: Per-provider storage
- **Never Commit**: No secrets in `.env` files, code, or config files in git

### Network Security

- TLS 1.3 required (terminate at load balancer)
- Internal traffic over private VPC subnets
- Security groups: DB accessible only from app tier, Redis same
- Database allowlist: Only app server IPs
- Helmet.js (or equivalent) for HTTP security headers:
  - HSTS (Strict-Transport-Security)
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Content-Security-Policy
  - Referrer-Policy: no-referrer

### CSRF Protection

- Double-submit cookie pattern
- Token embedded in forms/API calls
- Validate token on state-changing operations
- Exempt read-only endpoints

---

## Authentication Flows (Detailed Implementation)

### 1. Email + Password Flow

#### Signup

```
1. POST /auth/signup { email, password, name }
2. Validate input (Zod/Pydantic schema)
3. Check email not already registered
4. Validate password strength
5. Hash password (bcrypt cost=12 or Argon2id)
6. Create User record (emailVerified=false)
7. Create AuthAccount (provider="password", credential=hash)
8. Generate email verification token (CSPRNG 32 bytes → hex)
9. Store hashed token in Redis: verify:email:{hash} → userId, TTL=24h
10. Enqueue email job (verification email with link)
11. Return 201 { userId } (no session yet)
```

#### Login

```
1. POST /auth/login { email, password }
2. Fetch User + AuthAccount(provider="password")
3. Verify bcrypt/argon2 hash
4. Check emailVerified=true (reject if false)
5. Check user not soft-deleted or suspended
6. Create Session record:
   - Generate opaque refresh token (CSPRNG 32 bytes → base64)
   - Hash refresh token (SHA-256)
   - Store hash in Session table + Redis
   - Set expiresAt = now + 30 days
   - Capture deviceInfo (user-agent parsing) and IP
7. Sign JWT access token:
   - Payload: { userId, email, role }
   - Algorithm: RS256
   - Expiry: 15 minutes
8. Set HttpOnly cookies (access_token, refresh_token)
9. Log audit event: auth.login
10. Return 200 { user: { id, email, name, role } }
```

### 2. Magic Link Flow

#### Request Magic Link

```
1. POST /auth/magic-link { email, redirectUrl }
2. Validate email format
3. Find or create user (auto-registration)
4. Generate token (CSPRNG 32 bytes → hex)
5. Hash token (SHA-256)
6. Store in Redis: magic:{hash} → { userId, redirectUrl }, TTL=15min
7. Enqueue email job (magic link with callback URL)
8. Return 200 (always, no enumeration)
```

#### Magic Link Callback

```
1. GET /auth/magic-link/callback?token={raw}
2. Hash incoming token
3. Lookup in Redis: magic:{hash}
4. Verify TTL not expired
5. Delete key immediately (single-use enforcement)
6. Create Session (same as login flow step 6-7)
7. Set cookies
8. Redirect to redirectUrl (or default frontend URL)
```

### 3. OTP Flow

#### Request OTP

```
1. POST /auth/otp/request { email }
2. Validate email
3. Find or create user
4. Generate 6-digit numeric code
5. Hash code (SHA-256)
6. Store in Redis: otp:{email}:{hash} → { userId, attempts: 0 }, TTL=10min
7. Enqueue email job (OTP code)
8. Return 200 (always)
```

#### Verify OTP

```
1. POST /auth/otp/verify { email, code }
2. Hash code
3. Lookup Redis: otp:{email}:{hash}
4. Check attempts < 5
5. Increment attempt counter
6. Verify code match
7. Delete Redis key (single-use)
8. Create Session
9. Set cookies
10. Return 200 { user }
```

### 4. OAuth 2.0 Flow

#### Redirect to Provider

```
1. GET /auth/oauth/:provider (provider: google|github|microsoft|etc)
2. Validate provider supported
3. Generate state (CSPRNG, store in Redis with TTL=10min)
4. Generate PKCE code_verifier + code_challenge (SHA-256)
5. Build authorization URL:
   - provider auth endpoint
   - client_id
   - redirect_uri = /auth/oauth/:provider/callback
   - scope (email, profile, openid)
   - state
   - code_challenge + code_challenge_method=S256
6. Store code_verifier in Redis: oauth:{state} → verifier
7. Redirect to authorization URL
```

#### OAuth Callback

```
1. GET /auth/oauth/:provider/callback?code={code}&state={state}
2. Verify state exists in Redis (CSRF protection)
3. Retrieve code_verifier from Redis
4. Exchange code for access token:
   - POST to provider token endpoint
   - Include code, code_verifier, client_secret
5. Fetch user profile from provider (using access token)
6. Extract: providerId (sub), email, name, avatarUrl
7. Account Linking Logic:
   a. Lookup AuthAccount(provider, providerId)
   b. If exists → get linked User
   c. If not exists:
      - Check if User with email exists
      - If yes and link=true in query → link account
      - If yes and no link → error (email conflict)
      - If no → create new User + AuthAccount
8. Create Session
9. Set cookies
10. Redirect to frontend (or redirectUrl from state)
```

### 5. Refresh Token Rotation

```
1. POST /auth/refresh (cookie: refresh_token)
2. Extract refresh token from cookie
3. Hash token (SHA-256)
4. Lookup Session by refreshTokenHash
5. REUSE DETECTION CHECK:
   IF hash not found in Redis BUT found in DB with rotatedAt timestamp:
     → Token already rotated (REUSE)
     → Revoke all user sessions
     → Log audit event: auth.token_reuse_detected
     → Enqueue security alert email
     → Return 401
6. Verify session not expired (expiresAt > now)
7. Verify user not suspended/deleted
8. Generate new refresh token
9. Hash new token
10. Update Session:
    - refreshTokenHash = new hash
    - lastSeenAt = now
    - Mark old token as rotated (rotatedAt = now)
11. Update Redis with new hash
12. Sign new access token (JWT)
13. Set new cookies
14. Return 200
```

---

## Background Jobs

### Job Queue Architecture

- **Separate Worker Process**: Deploy workers independently from API
- **Graceful Shutdown**: Handle SIGTERM, finish in-flight jobs
- **Dead Letter Queue**: Failed jobs after max retries go to DLQ for manual review
- **Monitoring**: Queue depth, processing time, failure rate

### Job Types

#### Email Queue (High Priority)

| Job Name                  | Trigger              | Retry Policy                   | Notes                          |
| ------------------------- | -------------------- | ------------------------------ | ------------------------------ |
| `send-verification-email` | User signup          | 3 retries, exponential backoff | Critical for signup flow       |
| `send-magic-link`         | Magic link request   | 3 retries                      | Time-sensitive (15min TTL)     |
| `send-otp`                | OTP request          | 3 retries                      | Time-sensitive (10min TTL)     |
| `send-password-reset`     | Password reset       | 3 retries                      | Security-sensitive             |
| `send-security-alert`     | Token reuse detected | 5 retries                      | Critical security notification |
| `send-org-invite`         | Org invite created   | 3 retries                      | If multi-org implemented       |

#### Cleanup Queue (Cron Jobs)

| Job Name                 | Schedule           | Retry    | Notes                                               |
| ------------------------ | ------------------ | -------- | --------------------------------------------------- |
| `expire-old-sessions`    | Daily at 02:00 UTC | No retry | Delete sessions where expiresAt < now               |
| `hard-delete-users`      | Daily at 03:00 UTC | No retry | Permanent delete users where deletedAt < now-30days |
| `cleanup-expired-tokens` | Hourly             | No retry | Clean Redis: magic link, OTP, password reset tokens |

#### Audit Queue (Batch Processing)

| Job Name            | Trigger                 | Retry     | Notes                          |
| ------------------- | ----------------------- | --------- | ------------------------------ |
| `flush-audit-batch` | Every 30s or 100 events | 2 retries | Batch write audit events to DB |

---

## RBAC & Authorization

### Role Hierarchy

| Role      | Scope  | Permissions                                                                           |
| --------- | ------ | ------------------------------------------------------------------------------------- |
| **ADMIN** | Global | Full access: user management, role assignment, audit log access, all user permissions |
| **USER**  | Global | Read/update own profile, manage own sessions, create orgs (if multi-org)              |

**If Multi-Org Implemented**:
| Role | Scope | Permissions |
|------|-------|-------------|
| **OWNER** | Per-org | Full org control: delete org, manage members, change any role |
| **ADMIN** | Per-org | Invite members, remove members, change member roles (up to ADMIN) |
| **MEMBER** | Per-org | Read org data, access org resources |

### Middleware Chain

```
Incoming Request
  ↓
1. requestId() → Inject UUID, attach to req.requestId
  ↓
2. logger() → Log request start (method, path, IP, user-agent)
  ↓
3. helmet() → Set security headers
  ↓
4. cors() → Validate origin, set CORS headers
  ↓
5. rateLimit() → Check Redis counter, return 429 if exceeded
  ↓
6. csrf() → Validate CSRF token (if POST/PUT/DELETE)
  ↓
7. parseToken() → Extract JWT from cookie, verify signature, attach req.user (optional)
  ↓
8. requireAuth() → Enforce authentication (401 if no req.user)
  ↓
9. requireRole('ADMIN') → Check req.user.role (403 if insufficient)
  ↓
10. validateRequest() → Zod/Pydantic schema validation (422 if invalid)
  ↓
Controller Handler
  ↓
Response + Error Handling
```

---

## Observability & Monitoring

### Structured Logging

**Log Format** (JSON):

```json
{
  "level": "info",
  "timestamp": "2026-03-31T12:00:00.000Z",
  "requestId": "req_01HV...",
  "userId": "usr_01HV...",
  "method": "POST",
  "path": "/api/v1/auth/login",
  "statusCode": 200,
  "latencyMs": 42,
  "ip": "1.2.3.4",
  "userAgent": "Mozilla/5.0...",
  "message": "Login successful"
}
```

**Log Levels**:

- `DEBUG`: Verbose, development only
- `INFO`: Standard operations (requests, successful auth)
- `WARN`: Recoverable errors (rate limit hit, validation failed)
- `ERROR`: Unexpected errors (DB connection failure, unhandled exception)
- `FATAL`: Critical failures (app crash)

### Key Metrics (Prometheus Format)

| Metric                                     | Type      | Description                            | Alert Threshold               |
| ------------------------------------------ | --------- | -------------------------------------- | ----------------------------- |
| `http_request_duration_ms` (p50, p95, p99) | Histogram | Request latency by endpoint            | p95 > 200ms on auth endpoints |
| `http_requests_total`                      | Counter   | Total requests by method, path, status | -                             |
| `http_error_rate`                          | Gauge     | 5xx errors / total requests            | > 1% in 5min window           |
| `db_query_duration_ms` (p95)               | Histogram | Database query time                    | > 100ms                       |
| `db_connections_active`                    | Gauge     | Current DB connections                 | > 80% of pool size            |
| `redis_memory_used_bytes`                  | Gauge     | Redis memory usage                     | > 80% of max memory           |
| `redis_commands_total`                     | Counter   | Redis operations by command            | -                             |
| `queue_jobs_waiting`                       | Gauge     | Pending jobs in queue                  | > 500 in email queue          |
| `queue_jobs_failed_total`                  | Counter   | Failed jobs by queue                   | Spike detection               |
| `active_sessions_total`                    | Gauge     | Current active sessions                | Monitor growth trend          |
| `failed_login_attempts_total`              | Counter   | Failed logins by IP                    | > 100/min from single IP      |

### Grafana Dashboards

**Required Dashboards**:

1. **API Overview**: Request rate, latency percentiles, error rate, status code distribution
2. **Authentication**: Login success/failure rate, OAuth flow success rate, token rotation rate, active sessions
3. **Infrastructure**: CPU, memory, disk usage, DB connections, Redis memory
4. **Background Jobs**: Queue depth, processing time, failure rate, DLQ size
5. **Security**: Failed login attempts by IP, rate limit hits, token reuse events, suspicious patterns

### Audit Events

| Event Action          | Trigger                      | Metadata                                              |
| --------------------- | ---------------------------- | ----------------------------------------------------- |
| `auth.signup`         | New user created             | userId, email (hashed), method                        |
| `auth.login`          | Successful login             | userId, method (password/oauth/magic/otp), ip, device |
| `auth.login_failed`   | Failed login                 | email (hashed), reason, ip, userAgent                 |
| `auth.logout`         | Explicit logout              | userId, sessionId                                     |
| `auth.token_refresh`  | Refresh token rotated        | userId, sessionId                                     |
| `auth.token_reuse`    | **CRITICAL** Reuse detected  | userId, ip, device, ALL sessions revoked              |
| `auth.password_reset` | Password successfully reset  | userId                                                |
| `auth.email_verified` | Email verification completed | userId                                                |
| `session.created`     | New session established      | userId, sessionId, device, ip                         |
| `session.revoked`     | Session manually revoked     | sessionId, revokedBy (userId or "system")             |
| `user.updated`        | Profile updated              | userId, fields changed                                |
| `user.deleted`        | Account soft-deleted         | userId, scheduledHardDeleteAt                         |
| `user.role_changed`   | Role updated by admin        | targetUserId, oldRole, newRole, changedBy (adminId)   |
| `user.suspended`      | Account suspended            | userId, suspendedBy, reason                           |
| `org.created`         | Organization created         | orgId, createdBy                                      |
| `org.member_invited`  | Member invited               | orgId, email, invitedBy                               |
| `org.member_joined`   | Member accepted invite       | orgId, userId                                         |
| `org.member_removed`  | Member removed               | orgId, userId, removedBy                              |

---

## Testing Requirements

### Unit Tests (≥80% Coverage Target)

**Test Coverage**:

- All service layer business logic
- Authentication strategies (password, magic link, OTP, OAuth)
- Token generation and validation
- RBAC logic
- Refresh token rotation and reuse detection (CRITICAL)
- Input validation schemas
- Utility functions

**Mocking**:

- Mock database (Prisma, SQLAlchemy)
- Mock Redis
- Mock email service
- Mock OAuth provider responses

**Example Test Structure**:

```
describe('AuthService', () => {
  describe('login', () => {
    it('should create session on valid credentials')
    it('should reject unverified email')
    it('should reject wrong password')
    it('should reject suspended user')
    it('should increment failed login counter')
  })

  describe('refresh token rotation', () => {
    it('should issue new tokens on valid refresh')
    it('should detect token reuse')
    it('should revoke all sessions on reuse')
  })
})
```

### Integration Tests

**Scope**: Full HTTP request/response cycle with real DB and Redis

**Test Matrix**:

- ✅ Signup flow: happy path, duplicate email, weak password
- ✅ Login flow: correct creds, wrong password, unverified email, suspended user
- ✅ Logout flow: valid session, already logged out
- ✅ Refresh token rotation: valid rotation, expired token, **reuse detection** (CRITICAL)
- ✅ Magic link: request, callback success, expired token, reuse attempt
- ✅ OTP: request, verify success, wrong code, max attempts exceeded
- ✅ OAuth: new user, existing user account linking, conflict resolution
- ✅ Session management: list sessions, revoke by ID, revoke all
- ✅ RBAC: admin-only routes with admin role (200), user role (403), no auth (401)
- ✅ Rate limiting: exceed limits, verify 429 response, verify reset

**Setup**:

- Docker Compose with Postgres + Redis
- Run migrations before tests
- Seed minimal test data
- Clean database between test suites

### E2E Tests (Playwright/Cypress)

**Critical User Journeys**:

1. **OAuth Signup Flow**:
   - Click "Sign in with Google"
   - Authorize on Google (mock provider)
   - Redirect back to app
   - Verify session created
   - Verify cookies set correctly

2. **Magic Link Flow**:
   - Enter email
   - Receive email (mock SMTP server or email API)
   - Click link
   - Verify logged in

3. **Session Management**:
   - Login
   - Navigate to sessions page
   - See current session + device info
   - Revoke a specific session
   - Verify session removed

4. **Cookie Behavior**:
   - Verify HttpOnly, Secure, SameSite attributes
   - Verify access token expires after 15min
   - Verify refresh token refreshes access token

### Load Testing (k6 or Locust)

**Scenarios**:

1. **Baseline Load**: 100 requests/second for 5 minutes
2. **Spike Test**: Ramp from 0 to 500 RPS in 1 minute
3. **Sustained Load**: 200 RPS for 30 minutes
4. **Auth Endpoint Stress**: 1000 concurrent login attempts

**Success Criteria**:

- p95 latency < 200ms for auth endpoints
- p99 latency < 500ms
- Error rate < 0.1%
- No degradation at 10x baseline traffic
- Rate limiting engages correctly under attack

### Security Testing

**CI Pipeline**:

- `npm audit` / `pip-audit` / `cargo audit` (dependency scanning)
- Snyk or Trivy (container scanning)
- Block merge on high-severity CVEs

**Manual Testing Checklist** (before production):

- [ ] OWASP Top 10 coverage
- [ ] SQL injection attempts (Prisma prevents, but verify)
- [ ] CSRF token validation
- [ ] Rate limiting effectiveness
- [ ] Session fixation attacks
- [ ] JWT tampering attempts
- [ ] Password reset token enumeration
- [ ] Email enumeration prevention
- [ ] Brute force protection

---

## Deployment & Infrastructure

### Local Development Environment

**Docker Compose Setup** (required):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: relay
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: relay_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://relay:dev_password@postgres:5432/relay_dev
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src # Hot reload

  worker:
    build: .
    command: npm run worker
    environment:
      DATABASE_URL: postgresql://relay:dev_password@postgres:5432/relay_dev
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

**Local Setup Commands**:

```bash
# Clone and setup
git clone <repo>
cd relay
cp .env.example .env

# Start services
docker-compose up -d

# Run migrations
npm run migrate:dev  # or python manage.py migrate, go run migrate.go, etc.

# Seed database
npm run seed

# Start development server (with hot reload)
npm run dev
```

### Production Infrastructure (Terraform Example)

**Required Resources**:

1. **VPC** with public and private subnets across 2+ AZs
2. **EC2 Auto Scaling Group** (or ECS cluster):
   - Instance type: t3.small (baseline), scale to t3.medium
   - Min: 2 instances, Max: 10 instances
   - Scale triggers: CPU > 70%, or custom RPS metric
3. **Application Load Balancer**:
   - TLS termination (ACM certificate)
   - Target group health checks: `/health/ready`
   - Sticky sessions (optional, prefer stateless)
4. **RDS PostgreSQL**:
   - Instance class: db.t3.medium (adjustable)
   - Multi-AZ for HA
   - Automated backups (7-day retention)
   - Read replica (optional for scaling)
5. **ElastiCache Redis**:
   - Node type: cache.t3.medium
   - Cluster mode or replication group (for HA)
6. **Secrets Manager**: Store all secrets
7. **ECR**: Private Docker registry
8. **CloudWatch**: Logs and metrics
9. **Route 53** + **ACM**: DNS and SSL certificates
10. **IAM Roles**: EC2 instance role with secrets access

**Terraform Modules**:

```
infra/terraform/
├── main.tf
├── variables.tf
├── outputs.tf
├── modules/
│   ├── vpc/
│   ├── alb/
│   ├── ec2/
│   ├── rds/
│   ├── elasticache/
│   ├── ecr/
│   └── secrets-manager/
└── envs/
    ├── staging.tfvars
    └── prod.tfvars
```

### CI/CD Pipeline (GitHub Actions)

**Required Workflows**:

1. **`.github/workflows/ci.yml`** (runs on all PRs and pushes):

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup runtime (Node/Python/Go)
      - run: npm run lint # or equivalent

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - run: npm run typecheck # tsc --noEmit, mypy, etc.

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
      redis:
        image: redis:7
    steps:
      - run: npm run migrate:test
      - run: npm run test:integration

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - run: npm audit --production
      - uses: snyk/actions/node@master # or language-specific

  build:
    needs: [lint, typecheck, unit-test, integration-test]
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker image
        run: docker build -t relay:${{ github.sha }} .
      - name: Push to ECR (if main branch)
        if: github.ref == 'refs/heads/main'
```

2. **`.github/workflows/deploy-staging.yml`** (auto-deploy on push to `develop`):

```yaml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Run database migrations
      - name: Pull new image
      - name: Rolling restart (PM2 or ECS)
      - name: Smoke tests
```

3. **`.github/workflows/deploy-prod.yml`** (manual approval or auto on `main`):

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch: # Manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production # Requires approval
    steps:
      - name: Run migrations (with rollback plan)
      - name: Blue-green deployment (or canary)
      - name: Health check new instances
      - name: Switch traffic
      - name: Smoke tests
```

### Deployment Strategy

**Staging** (develop branch):

- Auto-deploy on push
- Rolling restart (zero-downtime)
- Run all integration tests post-deploy

**Production** (main branch):

- Blue-green deployment OR canary deployment
- Steps:
  1. Run migrations on current DB (with rollback script ready)
  2. Deploy new version to "green" environment
  3. Health check green instances
  4. Gradually shift traffic: 10% → 50% → 100%
  5. Monitor error rates and latency
  6. Keep blue environment running for 1 hour (quick rollback)
  7. Terminate blue environment if no issues

**Rollback Procedure**:

- If deployment fails: Revert load balancer to old target group
- If migration fails: Run rollback migration script
- Document rollback steps in runbook

---

## Documentation Requirements

### 1. README.md (Root)

````markdown
# Relay - Enterprise Identity Platform

## Overview

Brief description of the project.

## Features

- Multi-provider authentication (password, magic link, OTP, OAuth)
- Session management with refresh token rotation
- RBAC with admin and user roles
- Background job processing
- Comprehensive observability

## Tech Stack

- Runtime: [Node.js/Python/Go]
- Framework: [Express/FastAPI/Echo]
- Database: PostgreSQL with [Prisma/SQLAlchemy]
- Cache: Redis
- Queue: [BullMQ/Celery]
- Deployment: Docker + Terraform

## Quick Start

### Prerequisites

- Docker & Docker Compose
- [Runtime] (version X.X+)
- [Package manager]

### Local Development

```bash
# Setup
git clone [repo]
cp .env.example .env
docker-compose up -d
npm install
npm run migrate:dev
npm run seed

# Run
npm run dev  # API on http://localhost:3000
npm run worker  # Background jobs

# Test
npm run test
npm run test:integration
```
````

### Environment Variables

See `.env.example` for all required variables.

## API Documentation

- OpenAPI spec: `http://localhost:3000/openapi.json`
- Swagger UI: `http://localhost:3000/docs` (if implemented)

## Project Structure

[Link to architecture.md]

## Contributing

[Guidelines]

## License

[License type]

````

### 2. Architecture Documentation (`docs/architecture.md`)
- System overview diagram
- Module responsibilities
- Data flow diagrams
- Request/response cycle
- Database schema with relationships
- Caching strategy
- Background job architecture
- Security architecture (token flows, encryption)

### 3. API Documentation (`docs/openapi.json`)
- Auto-generated from validation schemas (Zod → OpenAPI, Pydantic → OpenAPI)
- Every endpoint documented with:
  - Request schema
  - Response schema
  - Error responses
  - Authentication requirements
  - Rate limits
  - Examples

### 4. Runbook (`docs/runbook.md`)
**Incident Response Playbook**:
```markdown
## Common Incidents

### Database Connection Exhaustion
**Symptoms**: 500 errors, "too many connections"
**Investigation**:
1. Check DB connection pool metrics
2. Check for long-running queries
**Resolution**:
1. Scale up DB instance
2. Increase connection pool size
3. Kill long-running queries if necessary

### Redis Down
**Symptoms**: Session creation fails, rate limiting disabled
**Investigation**: Check Redis health endpoint
**Resolution**:
1. Restart Redis (ElastiCache failover)
2. App gracefully degrades (no rate limiting)

### Token Reuse Storm
**Symptoms**: Mass session revocations, security alert emails flooding
**Investigation**: Check audit logs for auth.token_reuse
**Resolution**:
1. Verify it's not a bug (check recent deployments)
2. If attack: block offending IPs
3. Notify security team

[... more scenarios ...]
````

### 5. Architecture Decision Records (`docs/adr/`)

Example ADR:

```markdown
# ADR-002: RS256 over HS256 for JWT Signing

## Status

Accepted

## Context

Need to sign JWTs for access tokens. Two options:

- HS256 (symmetric, shared secret)
- RS256 (asymmetric, private/public key pair)

## Decision

Use RS256 (RSA-SHA256) with 2048-bit keys.

## Consequences

**Positive**:

- Public key can be safely distributed to verify tokens
- Supports key rotation without changing verifier
- Better security isolation (private key never leaves auth server)

**Negative**:

- Slightly slower than HS256
- More complex key management

## Implementation

- Store private key in AWS Secrets Manager
- Rotate every 90 days
- Use `kid` (key ID) in JWT header for multi-key support
```

### 6. Module README (`src/modules/auth/README.md`)

````markdown
# Auth Module

## Responsibilities

- User signup and email verification
- Login (password, magic link, OTP, OAuth)
- Token issuance and rotation
- Logout and session revocation

## Files

- `auth.router.*` - Express routes
- `auth.controller.*` - Request handlers
- `auth.service.*` - Business logic
- `auth.validators.*` - Zod schemas
- `strategies/` - Auth method implementations

## Key Flows

[Diagram or explanation of signup, login, token rotation]

## Configuration

- JWT_PRIVATE_KEY - RSA private key (from Secrets Manager)
- ACCESS_TOKEN_TTL - Default 15 minutes
- REFRESH_TOKEN_TTL - Default 30 days

## Testing

```bash
npm run test src/modules/auth
```
````

```

### 7. Deployment Documentation (`docs/deployment.md`)
- Infrastructure setup instructions (Terraform apply)
- CI/CD pipeline explanation
- Migration workflow
- Rollback procedures
- Monitoring and alerts setup
- Secrets rotation procedures

---

## Deliverables Checklist

### Code Deliverables
- [ ] Complete API implementation (all MVP endpoints)
- [ ] Database schema and migrations
- [ ] Seed scripts for local development
- [ ] Background worker implementation
- [ ] Middleware (auth, RBAC, rate limit, CSRF, logging)
- [ ] Error handling (custom error classes, global handler)
- [ ] Email templates (all 5+ types)
- [ ] Environment variable validation (fail fast on startup)

### Infrastructure Deliverables
- [ ] Dockerfile (multi-stage, optimized)
- [ ] Docker Compose (local dev: postgres, redis, api, worker)
- [ ] Terraform modules (VPC, ALB, EC2/ECS, RDS, ElastiCache, Secrets)
- [ ] CI/CD workflows (lint, test, build, deploy)
- [ ] Health check endpoints (liveness, readiness)

### Testing Deliverables
- [ ] Unit tests (≥80% coverage on business logic)
- [ ] Integration tests (key flows + error paths)
- [ ] E2E tests (critical user journeys)
- [ ] Load test scripts (k6 or Locust)
- [ ] Test fixtures and factories

### Documentation Deliverables
- [ ] README.md (root)
- [ ] Architecture documentation
- [ ] API documentation (OpenAPI spec)
- [ ] Runbook (incident response)
- [ ] Architecture Decision Records (ADRs)
- [ ] Module READMEs
- [ ] Deployment guide
- [ ] Environment variables reference

### Security Deliverables
- [ ] Secret management (no hardcoded secrets)
- [ ] JWT key rotation mechanism
- [ ] HTTPS/TLS configuration
- [ ] Rate limiting on all auth endpoints
- [ ] CSRF protection
- [ ] Security headers (Helmet)
- [ ] Audit logging
- [ ] Token reuse detection implementation

### Observability Deliverables
- [ ] Structured logging (JSON, correlation IDs)
- [ ] Error tracking (Sentry or equivalent)
- [ ] Metrics collection (Prometheus)
- [ ] Grafana dashboards (4+ dashboards)
- [ ] Alerting rules (critical thresholds)
- [ ] Uptime monitoring

---

## MVP Scope (Phase 1 - Must Have)

### Authentication Flows
✅ Email + password (signup, login, logout)
✅ Email verification
✅ Magic link authentication
✅ OTP authentication
✅ OAuth 2.0 (Google, GitHub minimum)
✅ Password reset flow

### Session & Token Management
✅ Short-lived access tokens (JWT RS256, 15min)
✅ Rotating refresh tokens (opaque, 30-day TTL)
✅ **Refresh token reuse detection** (CRITICAL)
✅ HttpOnly, Secure, SameSite cookies
✅ Session list and revoke APIs

### User Management
✅ User CRUD (create, read, update, soft delete)
✅ Profile management (name, avatar)
✅ Account linking (multiple OAuth providers)
✅ Email verification status

### Authorization
✅ Global roles: ADMIN, USER
✅ RBAC middleware (requireRole)
✅ Admin-only endpoints

### Background Jobs
✅ Email queue (verification, magic link, OTP, password reset, security alerts)
✅ Cleanup cron jobs (expired sessions, tokens, soft-deleted users)

### Infrastructure
✅ Dockerized API and worker
✅ CI/CD pipeline (lint, test, build, deploy)
✅ Database migrations (with rollback)
✅ Rate limiting (all auth endpoints)
✅ Terraform IaC (full infrastructure)

### Observability
✅ Sentry error tracking
✅ Structured logging (Pino or equivalent)
✅ Basic metrics (Prometheus)
✅ Health endpoints

---

## Phase 2 - Optional Enhancements (Implement if capacity allows)

### Advanced Features
- [ ] Multi-organization support (org CRUD, invites, memberships)
- [ ] 2FA with TOTP (Google Authenticator)
- [ ] SMS-based OTP (Twilio integration)
- [ ] API keys for machine-to-machine authentication
- [ ] Passkeys/WebAuthn support
- [ ] Device trust scoring
- [ ] Account recovery flow (backup codes)

### Admin Features
- [ ] Admin dashboard UI (user management, audit log viewer)
- [ ] Bulk user operations
- [ ] User impersonation (for support)
- [ ] Advanced audit log filtering and export (CSV/JSON)

### Observability Enhancements
- [ ] OpenTelemetry distributed tracing
- [ ] Custom Grafana dashboards (10+ views)
- [ ] PagerDuty/Opsgenie integration
- [ ] Log analysis with AI anomaly detection
- [ ] Performance profiling (flamegraphs)

### Scalability
- [ ] Multi-region deployment
- [ ] Read replicas for database
- [ ] Redis cluster mode (sharding)
- [ ] CDN for static assets
- [ ] Edge caching (Cloudflare Workers)

### Developer Experience
- [ ] GraphQL API (alongside REST)
- [ ] SDK generation (TypeScript, Python, Go clients)
- [ ] Webhook events (user.created, auth.login, etc.)
- [ ] Developer portal with interactive docs

---

## Success Criteria (MVP Acceptance)

The project is considered complete when ALL of the following criteria pass:

1. ✅ **All MVP endpoints functional**: Every endpoint in the API surface returns correct responses for happy paths and handles errors gracefully.

2. ✅ **Refresh token rotation works**: Rotation test passes: old token rejected after rotation, new token accepted.

3. ✅ **Reuse detection triggers revocation**: Test scenario: present already-rotated token → all user sessions invalidated → security email sent.

4. ✅ **OAuth flows functional**: Full browser flow for Google and GitHub works end-to-end, including account linking and conflict resolution.

5. ✅ **Rate limiting prevents brute force**: Load test shows 429 responses after limit hit; counter resets correctly.

6. ✅ **RBAC enforced**: Integration tests confirm user-role access to admin routes returns 403.

7. ✅ **Background workers send emails**: Email jobs complete successfully; provider (Resend/SendGrid) receives API calls.

8. ✅ **CI pipeline enforces gates**: Cannot merge to main without passing lint, typecheck, and all tests.

9. ✅ **Staging auto-deploys**: Push to develop branch triggers automated deployment to staging environment.

10. ✅ **Error tracking captures context**: Trigger a 500 error → Sentry event shows requestId, userId, stack trace.

11. ✅ **Metrics visible**: Grafana dashboards display: request latency, error rate, queue depth, active sessions.

12. ✅ **OpenAPI spec accurate**: Generated spec validates against OpenAPI 3.1 standard; all endpoints documented with correct schemas.

13. ✅ **Documentation complete**: README, architecture docs, runbook, ADRs all present and comprehensive.

14. ✅ **Local dev environment works**: `docker-compose up` → run migrations → seed → API accessible at localhost.

15. ✅ **Load test passes**: Auth endpoints handle 10x baseline load with p95 latency < 200ms.

---

## Key Implementation Notes

### Critical Security Requirements
1. **Never log sensitive data**: No passwords, tokens, or PII in logs
2. **Constant-time comparisons**: Use timing-safe equals for token/password validation
3. **No enumeration**: Email endpoints always return 200 (password reset, magic link, OTP)
4. **Token reuse detection**: This is non-negotiable, implement carefully with tests
5. **Secure key storage**: All secrets in Secrets Manager, never in code/config

### Performance Considerations
1. **Database indexes**: Index all foreign keys and query filters
2. **Connection pooling**: Limit connections, reuse efficiently
3. **Redis pipelining**: Batch Redis operations where possible
4. **Lazy loading**: Don't load unnecessary relations
5. **Pagination**: Cursor-based for large datasets

### Code Quality Standards
1. **Type safety**: Strict TypeScript/type hints, no `any`/`object`
2. **Error handling**: Every async operation in try-catch
3. **Input validation**: All request bodies validated with schemas
4. **Comments**: Complex logic explained with inline comments
5. **Naming**: Descriptive, consistent naming conventions
6. **DRY**: Reusable functions, no copy-paste code

### Testing Standards
1. **Isolated tests**: Unit tests mock all external dependencies
2. **Clean state**: Integration tests reset DB/Redis between suites
3. **Descriptive names**: Test names explain what is being tested
4. **Arrange-Act-Assert**: Clear test structure
5. **Edge cases**: Test boundary conditions and error paths

---

## Additional Context for Agent

### Project Philosophy
This is **production-grade** software. Treat it as if it will handle millions of users in a security-critical context. Every line of code should reflect:
- **Security-first thinking**: Assume the worst, defend in depth
- **Operational maturity**: Code is read more than written; prioritize clarity
- **Reliability**: Graceful degradation, comprehensive error handling, meaningful logs
- **Maintainability**: Future developers (including you) should understand the code in 6 months

### Autonomy Guidelines
You have full autonomy to:
- Choose equivalent technologies from the options provided
- Make architectural micro-decisions (file structure, naming conventions)
- Implement creative solutions to complex problems
- Add helpful features beyond spec (if MVP is complete)
- Organize code for maximum clarity and maintainability

You must not:
- Skip security requirements or cut corners on auth flows
- Use insecure patterns (custom crypto, weak hashing, plaintext tokens)
- Hardcode secrets or skip environment validation
- Omit tests for critical paths (especially token reuse detection)
- Deliver incomplete documentation

### When Stuck
If you encounter ambiguity or need to make a trade-off decision:
1. Prioritize security over convenience
2. Prioritize correctness over speed
3. Prioritize clarity over cleverness
4. Document your reasoning (ADR if significant)
5. Ask clarifying questions if the user is available

---

## Final Deliverable Format

Please structure the final deliverable with:
1. **Root README.md** with quick start guide
2. **Complete source code** organized by module
3. **Infrastructure code** (Terraform, Docker files)
4. **CI/CD workflows** (.github/workflows/)
5. **Documentation** (docs/ folder with all required docs)
6. **Tests** (unit, integration, E2E with ≥80% coverage)
7. **.env.example** with all required variables documented
8. **Migration files** with rollback scripts
9. **Seed scripts** for local development data

---

## Questions for User (if applicable)

Before beginning implementation, consider asking the user:
1. **Language preference**: Do you have a preferred backend language/runtime?
2. **Cloud provider**: Any preference for AWS, GCP, Azure, or cloud-agnostic?
3. **Deployment target**: EC2, Kubernetes, serverless, or flexible?
4. **Email provider**: Resend, SendGrid, AWS SES, or other?
5. **Observability**: All-in-one platform (Datadog) or open-source stack (Prometheus/Grafana)?
6. **Multi-org support**: Should organizations be included in MVP or Phase 2?
7. **Additional OAuth providers**: Beyond Google/GitHub, any others required?
8. **Budget constraints**: Any cost considerations for cloud services?
```
