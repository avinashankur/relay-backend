# Runbook: API Rate Limit Exhaustion

**Service:** Auth Service / API Gateway
**Severity:** P2 (degraded) / P3 (internal/dev only)
**Owner:** Backend Engineering Team
**Last reviewed:** 2026-08-09
**Estimated resolution time:** 15 minutes

---

## Trigger

This runbook applies when:

- [ ] Developers or automated tests receive continuous `429 Too Many Requests` responses.
- OR: Users report they are blocked from logging in or requesting OTPs with a rate limit message.
- OR: Alert `HighRateLimitRejections` fires in Datadog/Grafana.

---

## Impact Assessment

Before acting, answer these:

- [ ] Is this happening locally or in production?
- [ ] Are all users blocked, or just a specific IP address / user ID?
- [ ] Is this a legitimate traffic spike or a malicious brute-force attack?

---

## 🛠 Local Development

> **Start here.** This section covers rate limit issues during local testing or CI/CD pipelines.

### Checklist

Before diving into specific fixes, run through this checklist:

- [ ] Are you running load tests or automated E2E tests against a local instance?
- [ ] Is your `NODE_ENV` properly set to `development` or `test`?

### Diagnosis

Run these checks in order:

#### 1. Check if the Rate Limiter is Active

Rate limits are usually backed by Redis.

```bash
docker-compose logs --tail=50 relay-api | grep -i "rate limit"
```

If you see logs about exceeding limits on specific endpoints (like `/request-otp` or `/login`), the Redis-backed rate limiter is rejecting your requests.

### Resolution Steps

Work through these in order. Stop when the issue is resolved.

#### Option A: Flush Local Redis State

If you just need to clear the current rate limit counters so you can continue testing manually:

```bash
# Safely clear the local Redis cache
docker-compose exec redis redis-cli FLUSHALL
```

> [!CAUTION]
> This will wipe all local sessions and OTPs as well. You will need to log in again.

#### Option B: Disable Rate Limiting for Development

If you are running automated tests that intentionally hammer the API, you should disable rate limiting or artificially raise the limits.

1. Open your local `.env` file.
2. Add or modify the rate limit threshold (if configurable in your app):
   ```env
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX_REQUESTS=10000 # Set very high for local dev
   ```
3. Restart the API:
   ```bash
   npm run dev
   ```

### Verification (Local)

Issue is resolved when:

- [ ] You can repeatedly hit the endpoint (e.g., login or OTP request) without receiving a `429` status code.

---

## 🚀 Production

> **Secondary section.** The exact commands depend on your deployment target.

### Trigger Confirmation

- Alert: `HighRateLimitRejections` fires.
- OR: Support reports legitimate users are being blocked globally.

**If P1 impact confirmed (Global block of legitimate users):** Notify `#incidents`.

### Diagnosis

```bash
# Check API logs for 429 errors to see which IPs are affected
kubectl logs -n production -l app=relay-api --since=15m | grep "429"
```

Look for patterns:

- Is it a single IP address requesting thousands of OTPs? (Malicious / Brute force).
- Are _all_ IPs getting blocked after just a few requests? (Misconfigured limit / WAF issue).

### Resolution Steps

#### Option A: Single Malicious IP / Bot Attack

If a single IP or small block of IPs is causing the spike:

1. **Do not disable the rate limiter.** It is doing its job protecting the backend.
2. Escalate to the Infrastructure team to block the offending IP address at the WAF (Web Application Firewall) or Cloudflare level.

#### Option B: Global Misconfiguration (Legitimate Traffic Blocked)

If a recent deployment lowered the rate limit threshold too much, or a sudden viral spike in legitimate traffic is being blocked:

1. Update the configuration (via environment variables or Kubernetes ConfigMap) to increase the limit.

```bash
kubectl edit configmap relay-config -n production
# Increase the MAX_REQUESTS value, save and exit
```

2. Restart the API servers to apply the new limits:

```bash
kubectl rollout restart deployment/relay-api -n production
```

#### Option C: Escalate

If the issue is beyond the scope of this runbook or is not resolved within 15 minutes:

| Escalate to        | When                       | How               |
| ------------------ | -------------------------- | ----------------- |
| [Infrastructure]   | Need WAF/Cloudflare blocks | PagerDuty / Slack |
| [Engineering Lead] | Suspected DDoS attack      | Slack             |

### Verification (Production)

Issue is resolved when:

- [ ] Legitimate traffic is no longer returning `429` errors.
- [ ] If an attack, the WAF is successfully dropping the traffic before it hits the API.
- [ ] No new alerts firing.

---

## Post-Incident

After resolution (dev or prod):

- [ ] Note the root cause in `#incidents` or your incident tracker.
- [ ] If it was an attack, review if current rate limit thresholds are appropriate.
- [ ] Update this runbook if any steps were wrong or missing.
