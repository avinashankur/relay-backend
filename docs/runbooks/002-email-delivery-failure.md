# Runbook: Email Delivery Failure

**Service:** Auth Service / Background Worker
**Severity:** P2 (degraded - users cannot receive login codes)
**Owner:** Backend Engineering Team
**Last reviewed:** 2026-08-09
**Estimated resolution time:** 15-45 minutes

---

## Trigger

This runbook applies when:

- Alert: `EmailDeliveryFailed` or `ResendAPIError` fires in Datadog/Sentry
- OR: Users report they are not receiving OTPs, magic links, or verification emails
- OR: The BullMQ `email-queue` has a high number of jobs in the `failed` state

---

## Impact Assessment

Before acting, answer these:

- [ ] Are ALL emails failing, or just specific types/domains?
- [ ] Is the primary API server still successfully enqueuing jobs to Redis?
- [ ] Is the third-party provider (Resend) reporting an outage?

**If P2 impact confirmed:** Users attempting to log in via email (OTP or Magic Link) are completely blocked. Existing logged-in users are unaffected.

---

## Diagnosis

Run these checks in order to confirm the issue:

### 1. Check Third-Party Status

- Check [Resend Status Page](https://status.resend.com) (or your configured email provider).
- If the provider is down, there is nothing to fix in our code. See Resolution Option A.

### 2. Check Worker Logs

Emails are sent asynchronously via BullMQ in the worker process.

```bash
# Check worker logs for specific Resend/SMTP errors
kubectl logs -n production -l app=relay-worker | grep -i "email\|resend\|error"
```

Key errors to look for:

- `401 Unauthorized` → The `RESEND_API_KEY` has expired or been revoked.
- `429 Too Many Requests` → We hit the provider's rate limit.
- `500 Internal Server Error` (from provider) → Provider is having issues.

### 3. Check BullMQ Failed Queue

Check the background job dashboard or query Redis directly to see if jobs are piling up in the failed state.

---

## Resolution Steps

Work through these in order. Stop when the issue is resolved.

### Option A: Provider Outage

If Resend/SendGrid is down:

1. **Acknowledge the alert.**
2. **Update the Status Page:** Post an incident stating "We are currently experiencing delays in sending authentication emails due to a provider outage."
3. **Wait:** BullMQ is configured with exponential backoff. The jobs will sit in the delayed/failed queues and automatically retry as the provider recovers.
4. **Replay (if necessary):** Once the provider is green, you can manually trigger retries for any jobs that exhausted their maximum retry count using the BullMQ dashboard.

### Option B: Invalid API Key

If logs show authentication errors with the email provider:

1. Log into the Resend dashboard and generate a new API key.
2. Update the Kubernetes Secret or environment variable:

```bash
# Example for updating a generic secret
kubectl edit secret relay-secrets -n production
```

3. Restart the worker process to pick up the new key:

```bash
kubectl rollout restart deployment/relay-worker -n production
```

### Option C: Rate Limiting

If logs show `429 Too Many Requests`:

1. Identify if a specific user/IP is spamming the `/request-otp` endpoint and ban them at the WAF level.
2. If legitimate traffic has exceeded our plan limits, log into the provider dashboard and urgently request a quota increase or upgrade the billing plan.

---

## Local Development Troubleshooting

If emails are failing to send during local development (`npm run dev:worker`):

- **Is the worker running?** Emails are sent by the background worker. Ensure you are running `npm run dev:worker` in a separate terminal tab alongside the main API.
- **Missing API Keys:** Verify that `RESEND_API_KEY` is present in your local `.env` file. Without it, the worker will throw 401s.
- **Test Mode:** To avoid spamming real addresses or using up quota during testing, check if `NODE_ENV=development` is properly set. The worker can be configured to log emails to the console instead of calling Resend when running locally.

---

## Verification

Issue is resolved when:

- [ ] A manual test OTP request successfully arrives in your inbox.
- [ ] The BullMQ `failed` queue depth starts decreasing.
- [ ] Worker logs show successful `Email sent` messages.

---

## Escalation

If not resolved within 30 minutes, or if the issue is beyond this runbook's scope:

| Escalate to         | When                                              | How                                       |
| ------------------- | ------------------------------------------------- | ----------------------------------------- |
| Engineering Lead    | Suspected code bug in email templates             | Slack: `@engineering-lead`                |
| Third-party Support | Provider is down but status page says operational | Open urgent ticket via provider dashboard |

---

## Post-Incident

After resolution:

- [ ] Post in `#incidents`: "Resolved. Root cause: [brief]. Duration: [N] minutes."
- [ ] Ensure all delayed BullMQ jobs have finished processing.
