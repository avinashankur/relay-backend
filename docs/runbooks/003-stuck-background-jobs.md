# Runbook: Diagnosing Stuck Background Jobs

**Service:** Background Worker (BullMQ)
**Severity:** P2 (degraded - background processing halted)
**Owner:** Backend Engineering Team
**Last reviewed:** 2026-08-09
**Estimated resolution time:** 15-30 minutes

---

## Trigger

This runbook applies when:

- Alert: `HighQueueDepth` or `StalledJobsDetected` fires in Datadog/Sentry
- OR: Users report actions that rely on background jobs (emails, hard deletions) are not occurring.
- OR: Worker pods are continuously restarting (CrashLoopBackOff).

---

## Impact Assessment

Before acting, answer these:

- [ ] Are authentication emails (OTPs, Magic Links) delayed?
- [ ] Are background maintenance tasks failing?

**If P2 impact confirmed:** Asynchronous tasks are blocked. The main API is likely still functioning and accepting requests, but deferred work is piling up in Redis.

---

## Diagnosis

Run these checks in order to confirm the issue:

### 1. Check Worker Pod Status

```bash
# Are the workers actually running?
kubectl get pods -n production -l app=relay-worker
```

If pods are `CrashLoopBackOff`, the worker process is crashing immediately upon starting.

### 2. Check Worker Logs for Unhandled Exceptions

```bash
kubectl logs -n production -l app=relay-worker --previous
```

Look for:

- Unhandled Promise Rejections (e.g., trying to parse a bad payload).
- Out of Memory (`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed`).

### 3. Check BullMQ Queue Status

If you have a BullMQ dashboard (like Taskforce.sh or Bull-Board) deployed, check it. Alternatively, check Redis:

```bash
# Connect to Redis
redis-cli -h redis.internal.relay.com

# Check the length of the pending and active queues for 'email-queue'
LLEN bull:email-queue:wait
LLEN bull:email-queue:active
```

If `active` is full but jobs aren't completing, workers are stalled.

---

## Resolution Steps

Work through these in order. Stop when the issue is resolved.

### Option A: The "Poison Pill" Job

A specific job payload might be causing the worker to crash immediately upon picking it up (e.g., a malformed email address causing a validation library to panic).

1. Identify the crashing job by looking at the last log lines before the crash.
2. If confirmed, you must manually remove the bad job from Redis, or fix the code to handle the exception gracefully.
3. Temporary mitigation: Pause the queue, purge the specific bad job, unpause.

### Option B: Worker Deadlock / Stalled Jobs

Sometimes a Node.js worker event loop gets completely blocked by synchronous work, or an external API call hangs forever without a timeout, causing BullMQ to mark the job as "stalled".

1. **Restart the workers** to kill deadlocked processes:

```bash
kubectl rollout restart deployment/relay-worker -n production
```

2. BullMQ will automatically move jobs that were interrupted back to the `wait` queue to be retried by the fresh workers.

### Option C: Worker Resource Exhaustion (OOM)

If workers are crashing due to memory limits:

1. Temporarily increase the memory limits for the worker deployment:

```bash
kubectl set resources deployment/relay-worker \
 --limits=memory=1Gi -n production
```

2. Monitor the queue to see if it drains. If it drains successfully, file a ticket to investigate the memory leak or permanently increase the limit.

---

## Local Development Troubleshooting

If BullMQ jobs are getting stuck during local development:

- **Check Redis:** BullMQ relies on Redis. If your local Redis container (`docker-compose up redis`) crashes, jobs will hang.
- **Worker Process:** Ensure you have the worker process running in a separate terminal (`npm run dev:worker`). If you only start the API server, jobs will queue endlessly but never process.
- **Clearing local queues:** If your local queues are jammed with bad test data, you can flush them entirely by connecting to local Redis and dropping the keys, or simply wiping your Redis container:
  ```bash
  docker-compose rm -f -s redis
  docker-compose up -d redis
  ```

---

## Verification

Issue is resolved when:

- [ ] Worker pods are `Running` and stable.
- [ ] Queue depth (`bull:*:wait`) is actively decreasing and approaches 0.
- [ ] `StalledJobsDetected` alerts clear.

---

## Escalation

If not resolved within 30 minutes, or if the issue is beyond this runbook's scope:

| Escalate to         | When                                                  | How                        |
| ------------------- | ----------------------------------------------------- | -------------------------- |
| Engineering Lead    | Consistent worker crashes due to bad code             | Slack: `@engineering-lead` |
| Infrastructure Team | Redis memory is completely exhausted by queue backlog | Page via PagerDuty         |

---

## Post-Incident

After resolution:

- [ ] Post in `#incidents`: "Resolved. Root cause: [brief]. Duration: [N] minutes."
- [ ] Ensure timeouts are enforced on all network calls within jobs to prevent future stalls.
- [ ] Update this runbook if any steps were wrong or missing.
