# How to Test Emails Locally

> **Audience:** Backend Developers, QA
> **Time required:** 2-5 minutes
> **Last verified:** 2026-08-09

## Prerequisites

- Local `.env` file must contain a valid `RESEND_API_KEY`.
- Local Redis container must be running (`docker-compose up -d redis`).
- The project dependencies must be installed (`npm install`).

## Steps

Relay sends emails asynchronously using a BullMQ background worker. To test the email pipeline locally, you need to ensure the worker is running and then manually trigger a test job.

### 1. Start the Background Worker

In a dedicated terminal tab, start the worker process. The worker connects to Redis and listens for jobs on the `email-queue`.

```bash
npm run dev:worker
```

Expected result: The terminal should show that the worker has successfully connected to Redis and is waiting for jobs.

### 2. Trigger a Test Email

Open a new terminal tab and run the demo email script, passing your real email address as an argument.

```bash
npm run script:send-demo-email -- you@example.com
```

Expected result:

```text
Enqueueing demo email to you@example.com...
✓ Job enqueued (id: 1). The worker will deliver it shortly.
```

### 3. Verify Worker Logs

Switch back to the terminal where `npm run dev:worker` is running. You should see logs indicating the job was processed and the email was successfully sent via Resend.

## Verify it worked

Check the inbox of the email address you provided.

Expected result: You should receive an email with the subject "Welcome to Relay!". If it doesn't appear, check your spam/junk folder.

## Troubleshooting

| Problem                                                                                                    | Cause                                                                                                  | Fix                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `Error: connect ECONNREFUSED 127.0.0.1:6379`                                                               | The local Redis container is not running.                                                              | Run `docker-compose up -d redis` to start it.                                                           |
| The `script:send-demo-email` finishes successfully, but no email arrives and the worker logs show nothing. | You forgot to start the worker process. The job is sitting in the Redis queue waiting to be processed. | Run `npm run dev:worker` in a separate terminal. It will immediately pick up and send any pending jobs. |
| Worker logs show `401 Unauthorized`                                                                        | The `RESEND_API_KEY` in your `.env` file is missing or invalid.                                        | Update `.env` with a valid Resend API key and restart the worker.                                       |

## Related

- [Email Delivery Failure Runbook](../runbooks/002-email-delivery-failure.md)
- [Stuck Background Jobs Runbook](../runbooks/003-stuck-background-jobs.md)
