/**
 * Resend error classification for BullMQ handlers.
 *
 * Resend returns a typed `error` object with a `name` field. Errors whose
 * `name` begins with one of the NON_RETRYABLE_PREFIXES will never succeed on
 * retry (bad API key, invalid recipient address, domain not verified, etc.).
 * Throwing UnrecoverableError tells BullMQ to skip all remaining attempts and
 * move the job directly to the failed set.
 *
 * All other errors (rate limits, network timeouts, 5xx server errors) are
 * treated as transient and will be retried with exponential + jitter backoff
 * as configured in email.queue.ts.
 *
 * See TODO.md [EMAIL-04].
 */
import { UnrecoverableError } from "bullmq";

/**
 * Resend error name prefixes that indicate a permanent, non-retryable failure.
 * Source: https://resend.com/docs/api-reference/errors
 */
const NON_RETRYABLE_PREFIXES = [
  "invalid_api_key",
  "validation_error", // malformed request payload
  "missing_required_field",
  "invalid_from_address",
  "invalid_to_address",
  "domain_not_verified",
  "not_found",
  "method_not_allowed",
  "restricted_api_key",
] as const;

export interface ResendError {
  name: string;
  message: string;
  statusCode?: number | null;
}

/**
 * Inspects a Resend API error and throws the correct BullMQ error type:
 *  - UnrecoverableError  → permanent failure; skip remaining retry attempts
 *  - Error               → transient failure; BullMQ will retry per backoff policy
 *
 * @param error  The `error` field from `resend.emails.send()`.
 * @param context  Log context (e.g. { userId, email, jobName }) for structured logging.
 */
export function throwResendError(
  error: ResendError,
  context: Record<string, unknown>,
): never {
  const errorName = error.name?.toLowerCase() ?? "";
  const isPermanent = NON_RETRYABLE_PREFIXES.some((prefix) =>
    errorName.startsWith(prefix),
  );

  if (isPermanent) {
    throw new UnrecoverableError(
      `Resend permanent error [${error.name}]: ${error.message} — context: ${JSON.stringify(context)}`,
    );
  }

  throw new Error(`Resend transient error [${error.name}]: ${error.message}`);
}
