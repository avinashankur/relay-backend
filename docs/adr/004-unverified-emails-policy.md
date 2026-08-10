# 004-ADR: Unverified Email Login Policy

**Date:** -
**Status:** Accepted
**Deciders:** Engineering Team
**Tags:** auth, security, environments, user-experience

---

## Context

During the standard email/password authentication flow, users register with an email address. Standard security best practices dictate that users must verify ownership of that email address (via an emailed token or link) before they are allowed to establish an active session and access the application. This prevents spam, abuse, and account hijacking.

However, strictly enforcing this verification gate during active development significantly degrades the developer experience. It requires engineers and automated E2E tests to either run a local email interception server (like Mailhog) or check real inboxes just to create a basic test account. We need a strategy that balances strict production security with high development velocity.

## Decision

We will **allow unverified emails to log in and access the application during the development phase**.

This permissive behavior is strictly gated by the environment. When the application runs in production (`NODE_ENV === 'production'`), this gate will close, and unverified users will be rejected with an `EMAIL_UNVERIFIED` AuthError.

Furthermore, to reduce user friction, an account's email will be **automatically marked as verified** (bypassing the need for a dedicated verification email) if the user completes any authentication flow that inherently proves email ownership. These cases are:

1. **OAuth Login:** The user authenticates via a trusted third-party provider (e.g., Google, GitHub) that has already verified the email.
2. **Magic Link Login:** The user successfully clicks a short-lived, secure login link sent directly to their inbox.
3. **OTP Verification:** The user successfully inputs a one-time passcode sent directly to their email.
4. **Password Reset:** The user successfully resets their password using a secure link sent to their email.

## Alternatives Considered

### Option A: Strictly Enforce Verification Everywhere

- **Description:** Require email verification in local dev, staging, and production identically.
- **Pros:** Exact parity between all environments. No risk of the verification logic silently breaking in development without engineers noticing.
- **Cons:** High friction. E2E tests become brittle and complex, having to poll mail APIs to extract verification links. Developers spend unnecessary time clicking links during manual QA.
- **Why we didn't choose it:** The loss of development velocity outweighs the benefit of strict environmental parity for this specific feature.

### Option B: Introduce a "Bypass" Flag or Backdoor

- **Description:** Keep the strict enforcement in the code, but add a special HTTP header, query parameter, or global configuration flag (e.g., `ALLOW_DEV_BYPASS=true`) to skip it.
- **Pros:** Does not rely on `NODE_ENV`, giving QA the ability to bypass it even on a staging server.
- **Cons:** Extremely dangerous. If a backdoor flag or endpoint is accidentally left enabled or exposed in production, it creates a critical security vulnerability.
- **Why we didn't choose it:** Tying the behavior directly to the immutable runtime environment (`NODE_ENV !== 'production'`) is safer than relying on custom feature flags that could be misconfigured.

## Consequences

### Positive

- **Developer Velocity:** Engineers and automated tests can instantly create and log into test accounts without external dependencies.
- **User Experience:** By automatically verifying emails during Magic Link and OTP flows, we eliminate redundant verification steps for legitimate users, providing a seamless onboarding experience.

### Negative

- **Environmental Divergence:** The authentication flow behaves differently in development versus production. Engineers must consciously remember to test the strict verification path (e.g., by temporarily running the app in production mode locally) to ensure the logic remains intact.

## Follow-up Actions

- [ ] Ensure the `NODE_ENV` check is cleanly implemented in the `AuthService` login method.
- [ ] Ensure the Magic Link, OTP, and OAuth callback controllers correctly update the `emailVerified = true` flag on the user record upon success.
