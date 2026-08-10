# Runbook: Redis Failure Recovery

**Service:** Redis Cache / Auth Service
**Severity:** P1 (customer impact)
**Owner:** Backend Infrastructure Team
**Last reviewed:** 2026-08-09
**Estimated resolution time:** 15-30 minutes

---

## Trigger

This runbook applies when:

- Alert: `RedisConnectionFailure` fires in Datadog/Sentry
- OR: Users report being randomly logged out or unable to log in
- OR: Magic link and OTP emails are entirely failing to send (BullMQ jobs not queuing)

---

## Impact Assessment

Before acting, answer these:

- [ ] Are new users completely unable to log in?
- [ ] Are existing active sessions dropping?
- [ ] Is BullMQ processing halted?

**If P1 impact confirmed:** Redis is a critical dependency for session management, OTP rate-limiting, and background jobs. If Redis is completely unreachable, the auth service is effectively down. Notify `#incidents` channel immediately.

---

## Diagnosis

Run these checks in order to confirm the issue:

### 1. Check Redis connectivity from the API container

```bash
# Exec into a running API pod
kubectl exec -it -n production deployment/relay-api -- sh

# Attempt to ping Redis using redis-cli (assuming it's installed, or use telnet)
redis-cli -h redis.internal.relay.com ping
```

Expected output: `PONG`
If it hangs or returns `Connection refused`, Redis is down or unreachable.

### 2. Check Redis server logs (if self-hosted)

```bash
kubectl logs -n data-tier -l app=redis --tail=100
```

Key errors to look for:

- `OOM command not allowed when used memory > 'maxmemory'` → Redis hit its memory limit and eviction policies are failing or not set.
- `LOADING Redis is loading the dataset in memory` → Redis recently crashed/restarted and is restoring from an RDB/AOF file.

### 3. Check dashboards

- [Redis Overview Dashboard](#) (Look at Memory Usage, Connected Clients, and Evicted Keys)
- [BullMQ Dashboard](#) (Are jobs stalled?)

---

## Resolution Steps

Work through these in order. Stop when the issue is resolved.

### Option A: Redis is Out of Memory (OOM)

If Redis is rejecting writes due to OOM:

```bash
# Connect to Redis
redis-cli -h redis.internal.relay.com -a <password>

# Check current memory usage and limits
INFO memory

# Check eviction policy (should usually be volatile-lru or allkeys-lru for cache)
CONFIG GET maxmemory-policy
```

**Immediate mitigation:**
If the eviction policy is `noeviction` (default), change it so Redis can drop old sessions/OTPs to accept new logins:

```bash
# Safely change policy at runtime
CONFIG SET maxmemory-policy volatile-lru
```

Resolution check: Can you successfully log in? Are `OOM` errors gone from API logs?

### Option B: Redis Pod is CrashLooping (Kubernetes)

If the Redis pod itself is continually restarting:

```bash
# Restart the StatefulSet/Deployment
kubectl rollout restart statefulset/redis -n data-tier

# Watch rollout progress
kubectl rollout status statefulset/redis -n data-tier
```

Resolution check: All pods in Running state, error rate back to normal.

### Option C: Managed Redis (AWS ElastiCache / Upstash) is Unreachable

If using a managed provider and the endpoint is unreachable:

1. Check the AWS/Provider Console for ongoing maintenance or failovers.
2. If a failover occurred, ensure the API servers successfully re-resolved the DNS (Node.js can sometimes cache stale DNS).
3. If DNS is stale, forcibly restart the API servers to flush connections:

```bash
kubectl rollout restart deployment/relay-api -n production
kubectl rollout restart deployment/relay-worker -n production
```

---

## Local Development Troubleshooting

If you are experiencing Redis issues during local development (`npm run dev`):

- **Is Redis running?** Check your Docker Desktop or run `docker ps`. If the `relay-redis` container is missing or exited, start it with `docker-compose up -d redis`.
- **Wiping state:** If your local Redis gets corrupted or filled with test data, you can safely wipe it:
  ```bash
  docker-compose stop redis
  docker-compose rm redis
  docker-compose up -d redis
  ```
- **Testing OOM locally:** You can simulate an OOM locally by starting `redis-server` with `--maxmemory 10mb`.

---

## Verification

Issue is resolved when:

- [ ] Users can successfully request an OTP (writes to Redis).
- [ ] Users can successfully authenticate (creates a session in Redis).
- [ ] API error rates drop below 1%.
- [ ] No new `RedisConnectionFailure` alerts firing.

---

## Escalation

If not resolved within 15 minutes, or if the issue is beyond this runbook's scope:

| Escalate to         | When                                    | How                                              |
| ------------------- | --------------------------------------- | ------------------------------------------------ |
| Infrastructure Team | Redis is completely down/corrupt        | Page via PagerDuty: `pd trigger --service infra` |
| Engineering Lead    | Suspected memory leak in Node.js client | Slack: `@engineering-lead`                       |

---

## Post-Incident

After resolution:

- [ ] Post in `#incidents`: "Resolved. Root cause: [brief]. Duration: [N] minutes."
- [ ] Create follow-up ticket (e.g., "Investigate why Redis OOMed without evicting keys").
- [ ] Schedule post-mortem within 48 hours.
- [ ] Update this runbook if any steps were wrong or missing.
