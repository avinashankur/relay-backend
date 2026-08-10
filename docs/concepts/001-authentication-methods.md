## 1. What Is Authentication (and What It Isn't)

**Authentication (AuthN)** answers _"who are you?"_ — verifying an identity claim (a user, service, or device) against known credentials.

**Authorization (AuthZ)** answers _"what are you allowed to do?"_ — deciding whether an already-authenticated identity can perform an action.

These are almost always confused because the same word — "auth" — and often the same request/response cycle handle both. A login flow authenticates you; a scope or role check on a protected endpoint authorizes you. OAuth2, despite the name, is primarily an **authorization** framework, not an authentication one — this distinction matters later.

---

## 2. The Three Layers People Conflate

This is the root of most confusion in auth discussions (JWT vs Bearer, OAuth2 vs "login method", etc.). Auth concepts live at **three separate layers**, and mixing them up is why terms seem to overlap when they don't:

| Layer                         | Question it answers                                                     | Examples                                        |
| ----------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| **Framework / Protocol**      | _What is the overall trust and delegation model?_                       | OAuth2, OpenID Connect (OIDC), SAML             |
| **Scheme / Method**           | _How is the credential transmitted on the wire?_                        | Basic, Digest, Bearer, API Key (header/query)   |
| **Token / Credential format** | _What does the credential actually look like, and how is it validated?_ | Opaque random string, JWT, SAML assertion (XML) |

A single real system usually stacks all three. For example: OAuth2 (framework) issues an access token that is a JWT (format), sent using the Bearer scheme (method) in the `Authorization` header.

Keeping these three questions separate resolves almost every "isn't X the same as Y" confusion in this document. We'll return to this table's logic repeatedly.

---

## 3. Stateless vs Stateful Authentication

This is the single biggest architectural decision in auth system design — most other choices (session vs token, storage location, scaling strategy) fall out of this one.

### 3.1 Stateful Authentication

The server keeps a record of the session. On every request, the server looks up that record to confirm the identity is still valid.

- **How it works:** On successful login, server creates a session record (user ID, expiry, metadata) in a store (redis or DB), and gives the client a **session ID** (usually via cookie). Every request, the server takes that ID and looks up the record.
- **Server holds the truth.** The client only holds a pointer (the session ID) — it's meaningless without the server-side record.
- **Revocation is trivial:** delete the session record, and the ID is instantly useless.
- **Cost:** every request requires a lookup (network hop to Redis/DB unless cached), and the store must be shared across all server instances in a horizontally scaled deployment.

### 3.2 Stateless Authentication

The server verifies the credential using cryptography alone — no lookup against server-held state is needed.

- **How it works:** The token itself carries enough signed/encrypted information (identity, expiry, claims) that any server instance holding the verification key can validate it without querying a shared store.
- **Client holds the truth** (in a tamper-evident form) — the server just verifies the signature.
- **Scales horizontally with zero shared state** — any node with the public key / secret can validate independently.
- **Cost:** Revocation is hard. Since no server-side record is checked, a stolen-but-unexpired token stays valid until it naturally expires. This is the core tradeoff of stateless auth and the main reason short-lived access tokens + refresh token rotation exist (Section 8).

### 3.3 Quick Comparison

|                     | Stateful (session)             | Stateless (self-contained token, e.g. JWT)                                   |
| ------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| Server-side storage | Required (session store)       | Not required for validation                                                  |
| Revocation          | Instant (delete record)        | Delayed until expiry, unless a blocklist is added (which reintroduces state) |
| Horizontal scaling  | Needs shared/centralized store | Trivial — any node can verify                                                |
| Request cost        | Store lookup per request       | CPU-only signature check per request                                         |
| Payload size        | Small (opaque ID)              | Larger (encodes claims)                                                      |

Note: many production systems are **hybrid** — stateless access tokens for speed, paired with a stateful refresh-token record so revocation is still possible at the refresh layer. This is generally the sweet spot.

---

## 4. Auth Methods (Credential Transmission Schemes)

These are the mechanics of _how_ a credential rides on an HTTP request. This section stays at the "scheme" layer from Section 2 — not frameworks, not token formats.

### 4.1 Basic Authentication

```
Authorization: Basic base64(username:password)
```

- Credentials sent on **every single request**, base64-encoded (not encrypted — base64 is trivially reversible).
- No session, no token, no state — the simplest possible scheme.
- **Must** be run over TLS, or credentials are exposed in plaintext on the wire.
- **Challenges:** No expiry, no revocation without changing the password, no scoping, credentials repeatedly exposed on every hop (proxies, logs). Rarely appropriate for anything user-facing today; still seen for service-to-service or internal tooling.

### 4.2 Digest Authentication

- An evolution of Basic that avoids sending the raw password. The server sends a `nonce`; the client hashes `username:realm:password` combined with the nonce and sends the hash.
- Solves plaintext-over-wire exposure without TLS, but is largely obsolete now that TLS is ubiquitous.
- **Challenges:** Complex to implement correctly, weak against replay if nonces aren't managed carefully, no modern ecosystem support. Mentioned here mainly for completeness — avoid for new systems.

### 4.3 API Keys

- A single, long, high-entropy **random string** issued to a client (usually a service/application, not an end user), sent via a header (`X-API-Key`) or occasionally a query parameter.
- **Crucial distinguishing fact:** an API key is **just a random opaque string** — it carries no embedded claims or structure. The server's only way to know who it belongs to is a **database lookup** (key → owner mapping). This is why API keys are inherently stateful, even though they look like a "token."
- Typically used for machine-to-machine or third-party integration access (e.g. calling a public API), not for representing an interactively-logged-in human session.
- **Challenges:** No built-in expiry (must be enforced manually), no built-in scoping (must be modeled in the DB), easy to leak (accidentally committed to repos, logged, hardcoded in client-side code), revocation requires DB write + often cache invalidation.

### 4.4 Session-Based Authentication (Cookie + Session ID)

- The classic **stateful** pattern (Section 3.1). Client gets an opaque session ID in a cookie; server holds the session record.
- The cookie is transmitted automatically by the browser on same-site requests — no manual header wiring needed on the client, which is a major usability/security advantage (see Section 9).

### 4.5 Token-Based Authentication

"Token-based" is a broad umbrella — it just means _some token is presented instead of raw credentials_. It splits into two separate questions that people conflate:

1. **What scheme delivers it?** → Almost always **Bearer** (Section 4.5.1).
2. **What format is the token?** → Could be an **opaque random string** (functionally like a session ID or API key) **or a JWT** (Section 4.5.2).

#### 4.5.1 Bearer Authentication (the _scheme_, not the token format)

```
Authorization: Bearer <token>
```

- "Bearer" describes **how the credential is transmitted and what trust model it implies**: whoever _bears_ (holds) this token is granted access — no additional proof of identity (like a signature over the request) is required. It says **nothing about the token's internal structure**.
- A Bearer token can be:
  - An **opaque string** validated via server-side lookup (stateful), _or_
  - A **JWT** validated via signature check (stateless).
- **This is the single most common point of confusion in auth discussions**: "Bearer" is the delivery mechanism (a header format + trust assumption). "JWT" is one possible _format_ the token payload can take. They operate at different layers (Section 2) and are not substitutes for one another — you can have Bearer without JWT, and (less commonly) JWT delivered without the Bearer scheme (e.g. in a cookie).

#### 4.5.2 JWT (JSON Web Token) — a _format_, not a method

- A JWT is a specific, self-contained, cryptographically **signed** (and optionally encrypted) data structure: `header.payload.signature`, each part base64url-encoded.
  - **Header** — algorithm and token type metadata.
  - **Payload** — claims: identity, expiry (`exp`), issuer (`iss`), custom data.
  - **Signature** — proves the payload hasn't been tampered with, generated with a server-held secret (HMAC) or private key (RSA/ECDSA).
- Because the payload is only base64url-**encoded**, not encrypted, **anyone can read a JWT's contents** — signing guarantees integrity, not confidentiality. Never put secrets in a JWT payload.
- This is what enables **stateless verification** (Section 3.2): any server holding the secret/public key can check the signature and trust the claims without a DB call.

### 4.6 API Key vs JWT vs Opaque Bearer Token — Clearing the Overlap

These three are frequently lumped together because they can all appear as "a string in a header," but they differ fundamentally:

|                | API Key                              | Opaque Bearer Token                   | JWT (as Bearer token)                                  |
| -------------- | ------------------------------------ | ------------------------------------- | ------------------------------------------------------ |
| Structure      | Random string, no internal structure | Random string, no internal structure  | Structured, self-describing (header.payload.signature) |
| Validation     | DB/cache lookup required             | DB/cache lookup required              | Signature check — no lookup required                   |
| Statefulness   | Stateful                             | Stateful                              | Stateless (by default)                                 |
| Typical holder | Application / service                | User session (post-login)             | User session or service, esp. in distributed systems   |
| Expiry         | Usually none built-in                | Set server-side on the session record | Built into the token itself (`exp` claim)              |
| Revocation     | DB delete                            | DB delete — instant                   | Hard — needs a blocklist or short TTL + refresh flow   |

The key mental model: **API keys and opaque bearer tokens are "the same shape" (random strings needing a lookup) but different purposes** (service identity vs. user session). **JWTs are structurally different** from both — they carry their own proof, which is exactly why they trade easy revocation for scaling ease.

---

## 5. Access Tokens and Refresh Tokens

This pattern exists specifically to soften the stateless-revocation tradeoff from Section 3.2.

- **Access token:** short-lived (minutes, e.g. 15 min), sent on every API request, usually a JWT for fast stateless verification. Because it's short-lived, a leaked access token has a small exploitation window.
- **Refresh token:** long-lived (days/weeks), used _only_ to obtain a new access token from the auth server — never sent to resource/API servers directly. Typically stored server-side as a stateful record (or a rotating opaque token), specifically so it **can** be revoked.

Flow:

1. Login → server issues short access token + long refresh token.
2. Client uses access token for API calls until it expires.
3. Client silently calls the token endpoint with the refresh token to get a new access token.
4. If the refresh token was revoked (logout, compromise detected), this call fails and the user must re-authenticate.

**Refresh token rotation:** best practice is to issue a _new_ refresh token every time one is used, invalidating the old one. If an old (already-rotated) refresh token is ever presented, that's a strong signal of theft — the whole token family should be revoked.

This split gives you most of the scaling benefit of stateless tokens while keeping a real, revocable point of control — the refresh token is the place where "state" quietly comes back in.

---

## 6. OAuth2 — Delegated Authorization Framework

OAuth2 is a **framework**, not a login method or a token type. Its actual job: let a user grant a third-party application **limited access to their resources** on another service, without sharing their password with that third party.

Classic example: "Sign in with Google" letting an app read your Google Calendar — you never give the app your Google password; Google issues the app a scoped access token instead.

- **Key roles:** Resource Owner (the user), Client (the app requesting access), Authorization Server (issues tokens), Resource Server (hosts the protected data/API).
- **Grant types (flows)** — different ways to obtain a token depending on the client's trust level:
  - **Authorization Code (+ PKCE):** the standard modern flow, including for SPAs and mobile apps (PKCE removes the need for a client secret in public clients).
  - **Client Credentials:** machine-to-machine, no user involved.
  - **Refresh Token grant:** exchanging a refresh token for a new access token (Section 5).
  - Implicit and Resource Owner Password Credentials grants are legacy/deprecated — avoid for new designs.
- **What OAuth2 issues:** an **access token**, scoped to specific permissions — by spec, this token's _format is not defined_. It's commonly a JWT in practice, but OAuth2 doesn't require that.
- **Important:** OAuth2 alone tells the client _"this token can access X"_ — it says nothing reliable about _who the user is_. Using raw OAuth2 as a login mechanism (checking "did we get a token back") is a known anti-pattern — that's precisely the gap OpenID Connect fills.

---

## 7. OpenID Connect (OIDC) — Identity Layer on Top of OAuth2

OIDC is **not a competitor to OAuth2** — it's a thin identity layer built directly on top of it, adding actual **authentication** to OAuth2's authorization machinery.

- Adds a new token type: the **ID Token** — always a JWT, containing identity claims about the authenticated user (`sub`, `email`, `name`, `iss`, `aud`, etc.).
- Adds a standard `/userinfo` endpoint and standard **scopes** (`openid`, `profile`, `email`) to request identity data.
- So in an OIDC flow you receive _both_: an OAuth2 **access token** (for calling APIs) and an OIDC **ID token** (for knowing who logged in) — these are frequently mixed up because they look similar (both often JWTs) but serve different purposes.

This is the actual mechanism behind "Sign in with Google/Microsoft/Apple" buttons.

---

## 8. Single Sign-On (SSO)

SSO is a **user experience goal** — log in once, gain access to multiple independent applications — achieved using one of several underlying protocols. SSO is not itself a protocol; it's implemented via:

- **SAML (Security Assertion Markup Language):** XML-based, older, still dominant in enterprise/B2B contexts. An Identity Provider (IdP) issues a signed XML "assertion" to a Service Provider (SP) confirming identity. Browser-redirect based, no OAuth2 involved.
- **OIDC:** the modern, JSON/REST-based approach to the same problem (Section 7) — increasingly favored for new SSO implementations due to simpler tooling and mobile-friendliness.
- **OAuth2 (used loosely for SSO):** technically incomplete for pure authentication (Section 6), so "OAuth2 SSO" in practice usually really means OIDC riding on OAuth2's flows.

|                     | SAML                                 | OIDC                       |
| ------------------- | ------------------------------------ | -------------------------- |
| Data format         | XML                                  | JSON / JWT                 |
| Transport           | Browser redirects/POST bindings      | REST + redirects           |
| Mobile-friendliness | Poor                                 | Good                       |
| Typical context     | Enterprise, legacy IdPs (Okta, ADFS) | Modern consumer & B2B apps |

---

## 9. Session/Token Storage — Server Side

### 9.1 Why Not In-Memory Variables

Storing sessions in a plain server-process variable (an in-memory dict/map) seems simplest but breaks down almost immediately in real deployments:

- **Not shared across instances:** the moment you run more than one server process (horizontal scaling, or even just a restart-based rolling deploy), a session created on instance A is invisible to instance B. Users get randomly logged out depending on which instance handles their request.
- **Lost on restart/crash:** all sessions vanish — every deploy silently force-logs-out your entire user base.
- **No eviction strategy:** memory grows unbounded unless you build your own expiry/cleanup logic, essentially rebuilding a worse version of a real store.
- **No cross-process visibility for revocation:** logging out or banning a user on one instance won't propagate to others.

### 9.2 Preferred Session Stores

- **Redis / Memcached:** the standard choice — fast in-memory key-value stores with native TTL support (sessions expire automatically), shared across all server instances, and can be run in a replicated/clustered mode for high availability.
- **Database-backed (Postgres/MySQL table):** slower than Redis but durable and easy to query/audit; reasonable when session volume is low or durability matters more than raw speed.
- **Managed session stores (e.g., cloud-hosted Redis/ElastiCache):** operationally simplest for teams already on AWS — removes the need to self-host and cluster a store.

The common thread: a session store must be **centralized (shared across instances)**, **support expiry natively**, and **survive individual server restarts** — none of which a local variable provides.

---

## 10. Token Storage — Client Side

Where the _client_ keeps its session ID / access token / refresh token materially changes the system's attack surface.

| Storage                 | Persistence              | Auto-sent by browser        | XSS exposure                                                                             | CSRF exposure                 |
| ----------------------- | ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| `httpOnly` Cookie       | Until expiry/cleared     | Yes (same-site rules apply) | **No** — JS cannot read it                                                               | **Yes** — needs CSRF defenses |
| `localStorage`          | Until explicitly cleared | No — must attach manually   | **Yes** — any injected script can read it                                                | No — not auto-sent            |
| `sessionStorage`        | Cleared when tab closes  | No — must attach manually   | **Yes** — same as localStorage                                                           | No                            |
| In-memory (JS variable) | Lost on refresh          | No                          | Lower (harder to exfiltrate at rest, but still readable while running script has access) | No                            |

Practical guidance used in most modern designs:

- **Refresh tokens:** `httpOnly`, `Secure`, `SameSite=Strict` (or `Lax`) cookie — keeping it inaccessible to JavaScript is the priority, since it's the long-lived, high-value credential.
- **Access tokens:** often kept in memory only (a JS variable, re-fetched on page load via the refresh token) to minimize the window an XSS attack has to steal it, since it's short-lived anyway.
- **Avoid `localStorage`/`sessionStorage` for any token** if it can be avoided — they're directly readable by any script running on the page, making them the most XSS-exposed option.

This is a direct tradeoff: cookies defend well against XSS but need CSRF protection; `localStorage` needs no CSRF protection but is wide open to XSS. There's no storage location immune to both — defenses have to be layered (Section 11).

---

## 11. Security Flaws and Mitigations

### 11.1 XSS (Cross-Site Scripting)

- Attacker injects JS into your page (via unsanitized user input, vulnerable dependency, etc.) that runs with the page's privileges — able to read anything in `localStorage`/`sessionStorage`, or make authenticated requests using cookies.
- **Mitigations:** strict output encoding/sanitization, Content-Security-Policy headers, `httpOnly` cookies (removes token from JS reach entirely), avoiding `dangerouslySetInnerHTML`style patterns without sanitization.

### 11.2 CSRF (Cross-Site Request Forgery)

- Because browsers auto-attach cookies to requests, a malicious site can trigger a request to your API using the victim's own cookie, without needing to read it.
- **Mitigations:** `SameSite=Strict`/`Lax` cookies (blocks most cross-site sends automatically), CSRF tokens (a per-session secret the client must echo back in a header/body, unreadable by a third-party site), checking `Origin`/`Referer` headers.
- Note: pure Bearer-token-in-header schemes are naturally CSRF-immune, since a malicious site can't force your browser to attach a custom header — this is one real security advantage of moving away from cookies for API auth, at the cost of reopening XSS exposure (Section 10).

### 11.3 Session Fixation & Replay

- **Fixation:** attacker sets a known session ID on the victim before login, then uses that same ID after the victim authenticates. **Mitigation:** always issue a brand-new session ID on privilege change (login).
- **Replay:** a captured valid token/request is resent later. **Mitigation:** short expiries, nonces, rotating refresh tokens (Section 5), TLS everywhere to prevent capture in the first place.

### 11.4 DoS Considerations

- Auth endpoints are high-value DoS targets: login/token endpoints often do expensive work (password hashing, DB writes) per request, making them easy to overwhelm with comparatively cheap attacker requests.
- **Mitigations:** rate limiting per IP/account, exponential backoff on repeated failures, CAPTCHA after threshold failures, keeping session-store lookups fast (Redis over DB), separating auth-server load from resource-server load so a login flood doesn't take down the whole API.

### 11.5 Other Common Flaws

- **Token leakage in logs/URLs:** never put tokens in query strings — they end up in server logs, browser history, and referrer headers.
- **Weak signature validation:** accepting `alg: none` in JWTs, or failing to pin the expected signing algorithm, lets attackers forge tokens. Always explicitly whitelist accepted algorithms server-side.
- **Long-lived unrevocable tokens:** issuing long-expiry JWTs with no blocklist/refresh mechanism means a single leak is exploitable for the token's entire lifetime.

---

## 12. Summary — Choosing an Approach

| Scenario                                                                 | Reasonable choice                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Traditional server-rendered web app                                      | Stateful session + `httpOnly` cookie                                                                                                                                                                       |
| SPA/mobile app calling your own API                                      | Short JWT access token (in memory) + `httpOnly` cookie refresh token                                                                                                                                       |
| **Auth identity provider / session-based API**                           | **Hybrid:** short-lived RS256 JWT access token (stateless, verified locally) + long-lived opaque refresh token (hashed in DB, rotated on every use, with reuse-detection) delivered via `httpOnly` cookies |
| Third-party app needing limited access to a user's data on your platform | OAuth2                                                                                                                                                                                                     |
| "Log in with X" identity delegation                                      | OpenID Connect                                                                                                                                                                                             |
| Enterprise app joining a company's existing identity provider            | SAML or OIDC (SSO)                                                                                                                                                                                         |
| Service-to-service / machine access                                      | API key or OAuth2 Client Credentials grant                                                                                                                                                                 |
| Internal tooling, low-risk, quick setup                                  | Basic Auth over TLS (with eyes open about its limits)                                                                                                                                                      |

The recurring theme across this document: **framework, scheme, and token format are three independent decisions** — and most real "which auth should I use" confusion resolves the moment those three are pulled apart.
