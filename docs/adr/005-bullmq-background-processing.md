# 005-ADR: BullMQ for Background Processing

**Date:** -
**Status:** Accepted
**Deciders:** Engineering Team
**Tags:** architecture, background-jobs, scaling, performance

---

## Context

Relay needs to perform asynchronous, I/O-heavy, or potentially long-running tasks. This includes sending transactional emails (magic links, OTPs, verification codes, security alerts), scheduling hard deletions of accounts after a 30-day grace period, and running periodic cleanups (like pruning expired sessions from the database).

Node.js is single-threaded. Performing these tasks synchronously within the main Express API request lifecycle would block the event loop, severely increasing API latency and reducing the overall throughput of the authentication service. We need a reliable mechanism to offload these tasks to background workers, ensuring they execute reliably even in the face of temporary failures or process restarts.

## Decision

We will use **BullMQ** (backed by our existing Redis infrastructure) as our job queue and background processing framework.

Jobs will be enqueued by the main API server. However, the actual processing of these jobs will be handled by a completely independent Node.js worker process (`src/worker.ts`). This worker process will be deployed as a separate container, allowing us to scale the API servers and background workers independently based on their distinct load profiles.

## Alternatives Considered

### Option A: In-memory Async Tasks

- **Description:** Firing off asynchronous tasks in the API request handler without awaiting them (e.g., `emailService.send().catch(console.error)`), or using basic `setTimeout`.
- **Pros:** No extra infrastructure or libraries required. Immediate implementation.
- **Cons:** Jobs are entirely ephemeral. If the API server crashes, restarts for a deployment, or shuts down, any pending jobs are permanently lost. There is no built-in mechanism for retries, exponential backoff, or dead-letter queues.
- **Why we didn't choose it:** Unacceptable reliability for critical security flows like password resets and verification emails.

### Option B: Dedicated Message Brokers (SQS / RabbitMQ / Kafka)

- **Description:** Using an enterprise-grade message broker for distributed task management.
- **Pros:** Highly scalable, language-agnostic, and designed for massive throughput.
- **Cons:** Requires provisioning and managing entirely new infrastructure components.
- **Why we didn't choose it:** We already use Redis for session management and rate limiting. Introducing SQS or Kafka just for transactional emails is unnecessary operational overhead for a small team. Reusing our existing Redis instance keeps the stack simple.

### Option C: PostgreSQL-backed Queues (e.g., Graphile Worker)

- **Description:** Using our primary PostgreSQL database as the job queue.
- **Pros:** Zero additional infrastructure. Transactional guarantees (enqueueing a job in the same transaction as a database write).
- **Cons:** Polling the database for jobs adds unnecessary load to the primary data store, which should be reserved for core identity queries.
- **Why we didn't choose it:** Redis is inherently better suited for fast, ephemeral pub/sub and queue operations. BullMQ provides a much richer ecosystem for job management than most Postgres-backed tools.

## Consequences

### Positive

- **API Performance:** The main API thread remains unblocked, ensuring fast response times for critical authentication endpoints.
- **Reliability:** Guaranteed job execution with built-in retries, exponential backoff strategies, and dead-letter queues for failed jobs.
- **Infrastructure Efficiency:** Reusing our existing Redis cluster minimizes our operational footprint.
- **Independent Scaling:** Deploying the worker as a separate process allows us to scale email-sending capacity independently of web traffic capacity.

### Negative

- **Operational Complexity:** We must now deploy, monitor, and log a separate `worker` process alongside the main API server. Local development also requires running two processes concurrently (`npm run dev` and `npm run dev:worker`).
- **Redis Dependency:** If Redis is down, we cannot enqueue or process background jobs. However, since Redis is already a hard dependency for session management, this does not meaningfully expand our failure domains.

## Follow-up Actions

- [ ] Configure Prometheus/Grafana metrics for BullMQ to monitor queue depth, job latency, and failure rates.
- [ ] Implement a Dead Letter Queue (DLQ) retry UI or CLI tool for operations to replay failed email jobs.
