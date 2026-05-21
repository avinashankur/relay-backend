# Terraform AWS Infrastructure — Relay

> **Status**: Planned future-state. This document specifies the target Terraform
> layout described in `docs/architecture.md`. No `infra/` directory exists in the
> repository yet. See `TODO.md [DOCS-07]` for the backlog entry tracking this work.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Repository Layout](#3-repository-layout)
4. [Module Reference](#4-module-reference)
   - [4.1 VPC](#41-vpc)
   - [4.2 ECS (Fargate)](#42-ecs-fargate)
   - [4.3 ALB](#43-alb)
   - [4.4 RDS — PostgreSQL](#44-rds--postgresql)
   - [4.5 ElastiCache — Redis](#45-elasticache--redis)
   - [4.6 ECR](#46-ecr)
   - [4.7 Secrets Manager](#47-secrets-manager)
   - [4.8 IAM](#48-iam)
5. [Root Configuration Files](#5-root-configuration-files)
6. [Environment Variables](#6-environment-variables)
7. [Deployment Workflow](#7-deployment-workflow)
8. [Security Posture](#8-security-posture)
9. [Cost Guidance](#9-cost-guidance)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

Relay is a stateful TypeScript auth backend with three runtime processes:

| Process            | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| **API server**     | Express 5 HTTP server — handles all auth, session, and admin routes       |
| **Email worker**   | BullMQ worker — processes the outbound email queue via Resend             |
| **Cleanup worker** | BullMQ cron worker — expires sessions and hard-deletes soft-deleted users |

The AWS deployment topology maps each process to its own ECS Fargate task
definition, all sharing a private VPC, a single RDS Postgres instance, and a
single ElastiCache Redis cluster.

```
                        ┌──────────────────────────────┐
                        │           AWS VPC            │
                        │   (10.0.0.0/16)              │
                        │                              │
  Internet ─── ALB ─── │  ┌───────────┐               │
  (HTTPS/443)          │  │  Public   │  NAT Gateway   │
                        │  │  Subnets  │ ─────────────► │ ► Internet
                        │  └─────┬─────┘               │
                        │        │                     │
                        │  ┌─────▼──────────────────┐  │
                        │  │     Private Subnets     │  │
                        │  │                         │  │
                        │  │  ECS Fargate Cluster    │  │
                        │  │  ┌──────────────────┐   │  │
                        │  │  │  API Task (×N)   │   │  │
                        │  │  ├──────────────────┤   │  │
                        │  │  │ Worker Task (×1) │   │  │
                        │  │  └──────────────────┘   │  │
                        │  │                         │  │
                        │  │  RDS Postgres           │  │
                        │  │  ElastiCache Redis      │  │
                        │  └─────────────────────────┘  │
                        └──────────────────────────────┘
```

---

## 2. Prerequisites

### Tooling

| Tool      | Minimum Version | Install                                                                       |
| --------- | --------------- | ----------------------------------------------------------------------------- |
| Terraform | `>= 1.7`        | [terraform.io/downloads](https://developer.hashicorp.com/terraform/downloads) |
| AWS CLI   | `>= 2.15`       | [aws.amazon.com/cli](https://aws.amazon.com/cli/)                             |
| Docker    | `>= 24`         | Required to build and push container images to ECR                            |
| `jq`      | any             | Used in helper scripts                                                        |

### AWS Account Setup

Before running Terraform you need:

1. **An AWS account** with billing enabled.
2. **An IAM user or role** with the following AWS managed policies (or equivalent
   custom policies):
   - `AmazonEC2FullAccess`
   - `AmazonECS_FullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonElastiCacheFullAccess`
   - `AmazonEC2ContainerRegistryFullAccess`
   - `SecretsManagerReadWrite`
   - `IAMFullAccess` (for creating task roles)
3. **Terraform remote state** — an S3 bucket + DynamoDB table for state locking.
   Create these once manually before the first `terraform init`:

```bash
# Create the state bucket (run once per AWS account)
aws s3api create-bucket \
  --bucket relay-terraform-state-<your-account-id> \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket relay-terraform-state-<your-account-id> \
  --versioning-configuration Status=Enabled

# Create the DynamoDB lock table
aws dynamodb create-table \
  --table-name relay-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

4. **A registered domain** (e.g. `relay.dev`) and an ACM certificate covering
   `*.relay.dev` in `us-east-1` (required for ALB HTTPS).

---

## 3. Repository Layout

The target `infra/` tree within the Relay monorepo:

```
infra/
└── terraform/
    ├── backend.tf             # Remote state config (S3 + DynamoDB)
    ├── main.tf                # Root module — wires all child modules
    ├── variables.tf           # Input variable declarations
    ├── outputs.tf             # Root-level outputs (ALB DNS, RDS endpoint, …)
    ├── versions.tf            # Required providers + version pins
    │
    ├── modules/
    │   ├── vpc/               # VPC, subnets, IGW, NAT, route tables
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   │
    │   ├── ecs/               # Fargate cluster, task defs, services, autoscaling
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   │
    │   ├── alb/               # Application Load Balancer + target groups
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   │
    │   ├── rds/               # RDS Postgres (Multi-AZ), subnet group, SG
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   │
    │   ├── elasticache/       # Redis cluster, subnet group, SG
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   │
    │   ├── ecr/               # Container registries (api + worker images)
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   │
    │   ├── secrets-manager/   # Secrets storage + rotation config
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   │
    │   └── iam/               # Task execution role + task role
    │       ├── main.tf
    │       ├── variables.tf
    │       └── outputs.tf
    │
    └── envs/
        ├── staging.tfvars     # Staging-specific variable overrides
        └── prod.tfvars        # Production-specific variable overrides
```

---

## 4. Module Reference

### 4.1 VPC

**Purpose**: Isolates all Relay resources in a dedicated network with public
subnets for load balancers and private subnets for compute and data.

**Key resources:**

| Resource                                | Description                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `aws_vpc`                               | CIDR `10.0.0.0/16`                                                                                |
| `aws_subnet` (×4)                       | 2 public (`10.0.0.0/24`, `10.0.1.0/24`) + 2 private (`10.0.10.0/24`, `10.0.11.0/24`) across 2 AZs |
| `aws_internet_gateway`                  | Attached to VPC for public subnet egress                                                          |
| `aws_nat_gateway` (×1 staging, ×2 prod) | Enables private subnet → internet (ECR pulls, Resend, Sentry)                                     |
| `aws_route_table`                       | Separate tables for public and private subnets                                                    |

**`modules/vpc/variables.tf`** (representative):

```hcl
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of AZs to spread subnets across"
  type        = list(string)
}

variable "environment" {
  description = "staging | production"
  type        = string
}
```

**`modules/vpc/outputs.tf`**:

```hcl
output "vpc_id"              { value = aws_vpc.this.id }
output "public_subnet_ids"   { value = aws_subnet.public[*].id }
output "private_subnet_ids"  { value = aws_subnet.private[*].id }
```

---

### 4.2 ECS (Fargate)

**Purpose**: Runs the API server, email worker, and cleanup worker as separate
Fargate services within a shared ECS cluster. Fargate is chosen over EC2 to
eliminate instance management overhead.

**Key resources:**

| Resource                        | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| `aws_ecs_cluster`               | Shared cluster — `relay-<env>`                            |
| `aws_ecs_task_definition` (×3)  | `relay-api`, `relay-email-worker`, `relay-cleanup-worker` |
| `aws_ecs_service` (×3)          | One service per task definition                           |
| `aws_appautoscaling_target`     | CPU-based autoscaling for API service                     |
| `aws_cloudwatch_log_group` (×3) | `/ecs/relay-<service>/<env>`                              |

**Task CPU/Memory sizing:**

| Service                | CPU | Memory  | Min Tasks              | Max Tasks               |
| ---------------------- | --- | ------- | ---------------------- | ----------------------- |
| `relay-api`            | 512 | 1024 MB | 1 (staging) / 2 (prod) | 4 (staging) / 10 (prod) |
| `relay-email-worker`   | 256 | 512 MB  | 1                      | 1                       |
| `relay-cleanup-worker` | 256 | 512 MB  | 1                      | 1                       |

**Container environment injection** (simplified task definition excerpt):

```hcl
container_definitions = jsonencode([{
  name      = "relay-api"
  image     = "${var.ecr_repository_url}:${var.image_tag}"
  essential = true

  portMappings = [{
    containerPort = 5000
    protocol      = "tcp"
  }]

  environment = [
    { name = "NODE_ENV",  value = "production" },
    { name = "PORT",      value = "5000" },
  ]

  secrets = [
    { name = "DATABASE_URL",    valueFrom = "${var.secret_arn}:DATABASE_URL::" },
    { name = "REDIS_URL",       valueFrom = "${var.secret_arn}:REDIS_URL::" },
    { name = "JWT_PRIVATE_KEY", valueFrom = "${var.secret_arn}:JWT_PRIVATE_KEY::" },
    { name = "JWT_PUBLIC_KEY",  valueFrom = "${var.secret_arn}:JWT_PUBLIC_KEY::" },
    { name = "RESEND_API_KEY",  valueFrom = "${var.secret_arn}:RESEND_API_KEY::" },
    { name = "CSRF_SECRET",     valueFrom = "${var.secret_arn}:CSRF_SECRET::" },
    { name = "SENTRY_DSN",      valueFrom = "${var.secret_arn}:SENTRY_DSN::" },
  ]

  logConfiguration = {
    logDriver = "awslogs"
    options = {
      awslogs-group         = "/ecs/relay-api/${var.environment}"
      awslogs-region        = var.aws_region
      awslogs-stream-prefix = "api"
    }
  }

  healthCheck = {
    command     = ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"]
    interval    = 30
    timeout     = 5
    retries     = 3
    startPeriod = 60
  }
}])
```

> **Note**: The `relay-api` image and the `relay-email-worker` / `relay-cleanup-worker`
> images should be built from separate Dockerfiles (`Dockerfile` and `Dockerfile.worker`)
> as documented in `docs/architecture.md`. The worker tasks should **not** expose any
> port mappings and should not be registered with the ALB target group.

---

### 4.3 ALB

**Purpose**: Terminates HTTPS traffic and routes to the API Fargate service.
Workers are not internet-facing and are not connected to the ALB.

**Key resources:**

| Resource                     | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| `aws_lb`                     | Internet-facing ALB in public subnets               |
| `aws_lb_listener` (port 443) | HTTPS with ACM certificate                          |
| `aws_lb_listener` (port 80)  | Redirects to HTTPS (301)                            |
| `aws_lb_target_group`        | `relay-api` — health check `GET /health`            |
| `aws_security_group`         | Allows `0.0.0.0/0:443` inbound; API SG inbound only |

**Health check configuration:**

```hcl
health_check {
  path                = "/health"
  protocol            = "HTTP"
  port                = "5000"
  healthy_threshold   = 2
  unhealthy_threshold = 3
  timeout             = 5
  interval            = 30
  matcher             = "200"
}
```

> The `/health` endpoint must return `HTTP 200`. Wire this route in `src/server.ts`
> before deploying — it should check Prisma connectivity and Redis ping.

---

### 4.4 RDS — PostgreSQL

**Purpose**: Managed Postgres 16 database for Prisma ORM. RDS handles
automated backups, minor version patching, and Multi-AZ failover in production.

**Key resources:**

| Resource                 | Description                                   |
| ------------------------ | --------------------------------------------- |
| `aws_db_instance`        | Postgres 16, Multi-AZ in prod                 |
| `aws_db_subnet_group`    | Private subnets only                          |
| `aws_security_group`     | Ingress from ECS tasks only (port 5432)       |
| `aws_db_parameter_group` | `pg_stat_statements`, `max_connections = 100` |

**Sizing:**

| Environment | Instance Class | Storage   | Multi-AZ | Backup Retention |
| ----------- | -------------- | --------- | -------- | ---------------- |
| Staging     | `db.t3.micro`  | 20 GB gp3 | No       | 7 days           |
| Production  | `db.t3.small`  | 50 GB gp3 | Yes      | 30 days          |

**`modules/rds/variables.tf`** (representative):

```hcl
variable "instance_class"     { type = string }
variable "allocated_storage"  { type = number }
variable "multi_az"           { type = bool    default = false }
variable "backup_retention"   { type = number  default = 7 }
variable "db_name"            { type = string  default = "relay" }
variable "db_username"        { type = string  default = "relay_app" }
variable "db_password"        { type = string  sensitive = true }
variable "vpc_id"             { type = string }
variable "subnet_ids"         { type = list(string) }
variable "allowed_sg_ids"     { type = list(string) }
```

**Connection string format** (stored in Secrets Manager):

```
postgresql://relay_app:<password>@<rds-endpoint>:5432/relay?schema=public&sslmode=require
```

> Set `sslmode=require` in production. Prisma will enforce SSL when this is
> present in `DATABASE_URL`.

---

### 4.5 ElastiCache — Redis

**Purpose**: Managed Redis 7 cluster for session tokens, OTP/magic-link
storage, BullMQ job queues, and rate-limiting sliding windows.

**Key resources:**

| Resource                            | Description                             |
| ----------------------------------- | --------------------------------------- |
| `aws_elasticache_replication_group` | Redis 7, cluster mode disabled          |
| `aws_elasticache_subnet_group`      | Private subnets only                    |
| `aws_security_group`                | Ingress from ECS tasks only (port 6379) |

**Sizing:**

| Environment | Node Type        | Replicas | Auth Token | TLS |
| ----------- | ---------------- | -------- | ---------- | --- |
| Staging     | `cache.t3.micro` | 0        | No         | No  |
| Production  | `cache.t3.small` | 1        | Yes        | Yes |

**Production Redis URL format** (stored in Secrets Manager):

```
rediss://:<auth-token>@<primary-endpoint>:6379
```

> Note the `rediss://` scheme (double-s) — this enables TLS in ioredis.
> The BullMQ `BULLMQ_REDIS_URL` variable should point to the same cluster on
> database index `1` to isolate queue data from session/token data:
> `rediss://:<auth-token>@<primary-endpoint>:6379/1`

---

### 4.6 ECR

**Purpose**: Private Docker registries for the API and worker container images.

**Key resources:**

| Repository     | Image built from                 |
| -------------- | -------------------------------- |
| `relay/api`    | `infra/docker/Dockerfile`        |
| `relay/worker` | `infra/docker/Dockerfile.worker` |

**Lifecycle policy** (applied to both repositories):

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 tagged images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["v"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 2,
      "description": "Remove untagged images after 7 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 7
      },
      "action": { "type": "expire" }
    }
  ]
}
```

---

### 4.7 Secrets Manager

**Purpose**: Stores all sensitive runtime credentials. ECS task definitions
reference these via the `secrets` field, so values are injected into the
container environment at launch time — never baked into the image.

**Secret structure** — a single JSON secret per environment:

```json
{
  "DATABASE_URL": "postgresql://relay_app:<pw>@<rds>:5432/relay?sslmode=require",
  "REDIS_URL": "rediss://:<token>@<elasticache>:6379",
  "BULLMQ_REDIS_URL": "rediss://:<token>@<elasticache>:6379/1",
  "JWT_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "JWT_PUBLIC_KEY": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "RESEND_API_KEY": "re_live_...",
  "CSRF_SECRET": "<32+ char random string>",
  "SENTRY_DSN": "https://...@sentry.io/...",
  "COOKIE_DOMAIN": ".relay.dev"
}
```

**Secret naming convention:**

| Environment | Secret Name            |
| ----------- | ---------------------- |
| Staging     | `relay/staging/app`    |
| Production  | `relay/production/app` |

> Generate RSA keys with `npm run generate-keys` (see `scripts/generate-keys.ts`).
> Store the output PEM strings in Secrets Manager — **never commit private keys to Git**.

---

### 4.8 IAM

**Purpose**: Defines the two IAM roles required by ECS Fargate.

#### Task Execution Role (`relay-ecs-execution-role`)

Used by the ECS control plane to pull images and inject secrets. Required policies:

- `AmazonECSTaskExecutionRolePolicy` (AWS managed)
- Inline policy allowing `secretsmanager:GetSecretValue` on `relay/<env>/app`
- Inline policy allowing `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`,
  `ecr:GetDownloadUrlForLayer`

#### Task Role (`relay-ecs-task-role`)

Assumed by the running container process. Follow least-privilege:

- No Secrets Manager access (secrets are injected at launch, not read at runtime)
- `logs:CreateLogStream`, `logs:PutLogEvents` on `/ecs/relay-*`
- If Sentry or other AWS SDKs are used from within the container, add those
  specific permissions here

---

## 5. Root Configuration Files

### `infra/terraform/versions.tf`

```hcl
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "relay"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
```

### `infra/terraform/backend.tf`

```hcl
terraform {
  backend "s3" {
    bucket         = "relay-terraform-state-<your-account-id>"
    key            = "relay/${var.environment}/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "relay-terraform-locks"
    encrypt        = true
  }
}
```

### `infra/terraform/variables.tf`

```hcl
variable "aws_region"         { type = string  default = "us-east-1" }
variable "environment"        { type = string }   # "staging" | "production"
variable "image_tag"          { type = string  default = "latest" }
variable "acm_certificate_arn" { type = string }
variable "domain_name"        { type = string  default = "relay.dev" }
```

### `infra/terraform/envs/staging.tfvars`

```hcl
environment  = "staging"
aws_region   = "us-east-1"
domain_name  = "relay.dev"
# acm_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/..."
```

### `infra/terraform/envs/prod.tfvars`

```hcl
environment  = "production"
aws_region   = "us-east-1"
domain_name  = "relay.dev"
# acm_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/..."
```

---

## 6. Environment Variables

The table below cross-references every variable from `.env.example` with its
AWS source in the production environment.

| Variable                  | Production Source                                |
| ------------------------- | ------------------------------------------------ |
| `NODE_ENV`                | ECS task `environment` (hardcoded `production`)  |
| `PORT`                    | ECS task `environment` (hardcoded `5000`)        |
| `API_BASE_URL`            | ECS task `environment` (`https://api.relay.dev`) |
| `DATABASE_URL`            | Secrets Manager → `relay/<env>/app`              |
| `REDIS_URL`               | Secrets Manager → `relay/<env>/app`              |
| `BULLMQ_REDIS_URL`        | Secrets Manager → `relay/<env>/app`              |
| `JWT_PRIVATE_KEY`         | Secrets Manager → `relay/<env>/app`              |
| `JWT_PUBLIC_KEY`          | Secrets Manager → `relay/<env>/app`              |
| `JWT_ACCESS_TTL_SECONDS`  | ECS task `environment` (`900`)                   |
| `JWT_REFRESH_TTL_SECONDS` | ECS task `environment` (`2592000`)               |
| `RESEND_API_KEY`          | Secrets Manager → `relay/<env>/app`              |
| `EMAIL_FROM`              | ECS task `environment`                           |
| `CSRF_SECRET`             | Secrets Manager → `relay/<env>/app`              |
| `COOKIE_DOMAIN`           | Secrets Manager → `relay/<env>/app`              |
| `CORS_ORIGINS`            | ECS task `environment`                           |
| `SENTRY_DSN`              | Secrets Manager → `relay/<env>/app`              |
| `LOG_LEVEL`               | ECS task `environment` (`info`)                  |

---

## 7. Deployment Workflow

### First Deployment

```bash
# 1. Authenticate with AWS
aws configure  # or use SSO: aws sso login --profile relay-prod

# 2. Build and push images
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com

IMAGE_TAG=$(git rev-parse --short HEAD)

docker build -f infra/docker/Dockerfile \
  -t relay/api:$IMAGE_TAG .
docker tag relay/api:$IMAGE_TAG \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/relay/api:$IMAGE_TAG
docker push \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/relay/api:$IMAGE_TAG

# Repeat for Dockerfile.worker → relay/worker

# 3. Initialise Terraform
cd infra/terraform
terraform init

# 4. Plan the staging deployment
terraform plan \
  -var-file=envs/staging.tfvars \
  -var="image_tag=$IMAGE_TAG" \
  -out=staging.plan

# 5. Apply (creates all AWS resources)
terraform apply staging.plan

# 6. Seed secrets (one time)
aws secretsmanager create-secret \
  --name relay/staging/app \
  --secret-string file://secrets.staging.json
```

### Subsequent Deploys (image update only)

```bash
IMAGE_TAG=$(git rev-parse --short HEAD)

# Build + push (same as above)

# Only update the ECS service — Terraform handles the task definition update
terraform apply \
  -var-file=envs/staging.tfvars \
  -var="image_tag=$IMAGE_TAG" \
  -target=module.ecs \
  -auto-approve
```

### Promoting Staging → Production

```bash
terraform apply \
  -var-file=envs/prod.tfvars \
  -var="image_tag=$IMAGE_TAG"
```

### Running Prisma Migrations

Prisma migrations must run **before** the new ECS tasks start serving traffic.
The recommended pattern is an ECS one-off task:

```bash
aws ecs run-task \
  --cluster relay-production \
  --task-definition relay-api-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[...],securityGroups=[...],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"relay-api","command":["npx","prisma","migrate","deploy"]}]}'
```

Define a dedicated `relay-api-migrate` task definition in the ECS module that
uses the same image but overrides the command to `npx prisma migrate deploy`.
This task runs to completion and exits — it should not be registered with any
ECS service or ALB target group.

---

## 8. Security Posture

| Control                 | Implementation                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Network isolation**   | All compute and data resources in private subnets. Only the ALB is in public subnets.                           |
| **Secret injection**    | Secrets Manager values injected at task launch. Never in environment literals or image layers.                  |
| **TLS everywhere**      | ALB terminates HTTPS; RDS enforces `sslmode=require`; ElastiCache uses `rediss://` (TLS) in production.         |
| **Least-privilege IAM** | Task role has no Secrets Manager access. Execution role scoped to the specific secret ARN.                      |
| **Security Groups**     | RDS SG allows only ECS task SG on port 5432. ElastiCache SG allows only ECS task SG on port 6379.               |
| **JWT keys**            | RS256 private key stored in Secrets Manager, never committed to Git. Rotate with `npm run rotate-keys`.         |
| **CSRF**                | Double-submit cookie pattern enforced by `shared/middleware/csrf.ts`; `CSRF_SECRET` from Secrets Manager.       |
| **Rate limiting**       | Redis sliding-window rate limiting; `RATE_LIMIT_GLOBAL_RPM` and `RATE_LIMIT_LOGIN_RPM` tunable per environment. |
| **Image scanning**      | Enable ECR enhanced scanning (AWS Inspector) to catch OS and package CVEs on push.                              |
| **Terraform state**     | S3 state bucket has versioning + SSE-S3 encryption. DynamoDB lock prevents concurrent applies.                  |

---

## 9. Cost Guidance

Approximate **monthly** AWS costs for the described configuration (us-east-1,
on-demand pricing, no reserved instances):

| Resource                                        | Staging     | Production                   |
| ----------------------------------------------- | ----------- | ---------------------------- |
| ECS Fargate (API ×1, Workers ×2)                | ~$15        | ~$60 (×3 tasks, autoscaling) |
| RDS `db.t3.micro` / `db.t3.small`               | ~$15        | ~$40 (Multi-AZ)              |
| ElastiCache `cache.t3.micro` / `cache.t3.small` | ~$12        | ~$30 (1 replica)             |
| ALB                                             | ~$18        | ~$18                         |
| NAT Gateway (×1 / ×2)                           | ~$35        | ~$70                         |
| ECR storage (< 5 GB)                            | ~$0.50      | ~$0.50                       |
| Secrets Manager (1 secret)                      | ~$0.40      | ~$0.40                       |
| CloudWatch Logs                                 | ~$2         | ~$5                          |
| **Estimated Total**                             | **~$98/mo** | **~$224/mo**                 |

> **Cost optimisation tips:**
>
> - Use Fargate Spot for non-critical workers in staging (up to 70% savings).
> - Purchase 1-year reserved instances for RDS and ElastiCache in production.
> - A single shared NAT Gateway per VPC (not per AZ) is sufficient for staging.

---

## 10. Troubleshooting

### ECS tasks fail to start

1. Check CloudWatch Logs: `/ecs/relay-api/<env>` for startup errors.
2. Verify the task execution role has `secretsmanager:GetSecretValue` on the
   correct secret ARN.
3. Verify the ECR image URI and tag exist: `aws ecr describe-images --repository-name relay/api`.
4. Confirm the ECS task security group allows outbound HTTPS (443) for ECR pulls
   and Secrets Manager calls.

### Database connection refused

1. Confirm RDS is in `available` state: `aws rds describe-db-instances`.
2. Verify the ECS task security group ID is listed in the RDS security group
   inbound rules on port 5432.
3. Check `DATABASE_URL` in Secrets Manager includes `sslmode=require`.

### Redis connection timeouts

1. Check ElastiCache cluster status in the AWS console.
2. Ensure `REDIS_URL` uses `rediss://` scheme in production.
3. Verify the ElastiCache auth token matches the value in Secrets Manager.

### Prisma migration failed

1. Run the migration task manually using the `aws ecs run-task` command in
   [§7 Deployment Workflow](#7-deployment-workflow).
2. Check the migration task CloudWatch logs for the specific Prisma error.
3. If migration is destructive, take an RDS snapshot first:
   `aws rds create-db-snapshot --db-instance-identifier relay-<env> --db-snapshot-identifier pre-migration-<date>`.

### `terraform apply` fails on first run

1. Ensure the S3 state bucket and DynamoDB lock table exist (see [§2 Prerequisites](#2-prerequisites)).
2. Run `terraform validate` to catch HCL syntax errors before `apply`.
3. Check IAM permissions — the deploying user/role needs all policies listed in §2.

---

_Last updated: May 2026 — See `TODO.md [DOCS-07]` for implementation status._
