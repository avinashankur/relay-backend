# How to Generate RS256 JWT Keys

> **Audience:** Backend Developers, DevOps
> **Time required:** 5 minutes
> **Last verified:** 2026-08-09

## Prerequisites

- Access to a terminal with `openssl` installed.
- (Optional) AWS CLI installed if you are deploying to production.

## Steps

Relay uses asymmetric RS256 signatures for JWT access tokens. This requires an RSA Private Key (for signing) and a matching Public Key (for verification).

### 1. Generate the Private Key

Run the following command to generate a 2048-bit RSA private key:

```bash
openssl genrsa -out private.pem 2048
```

Expected result: A file named `private.pem` is created in your current directory.

### 2. Extract the Public Key

Generate the matching public key from the private key you just created:

```bash
openssl rsa -in private.pem -outform PEM -pubout -out public.pem
```

Expected result: A file named `public.pem` is created in your current directory.

### 3. Format Keys for `.env` (Local Development)

Modern versions of `dotenv` support multi-line environment variables if they are wrapped in quotes.

1. Open `private.pem` and copy its entire contents.
2. Open your `.env` file and paste it surrounded by double quotes:

```env
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----"
```

3. Do the exact same for `public.pem`:

```env
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
...
-----END PUBLIC KEY-----"
```

## Verify it worked

Start your local API server to verify that `env.ts` successfully parses the keys:

```bash
npm run dev
```

Expected result: The server starts successfully. If the keys are malformed, Zod will throw an error immediately upon startup and the process will exit.

## Production (AWS Secrets Manager)

In production, you should never store these keys in `.env` files or source control.

### 1. Store the Private Key in AWS

If you are using AWS Secrets Manager, you can upload the key directly:

```bash
aws secretsmanager create-secret \
    --name relay/production/jwt_private_key \
    --secret-string file://private.pem
```

### 2. Store the Public Key

```bash
aws secretsmanager create-secret \
    --name relay/production/jwt_public_key \
    --secret-string file://public.pem
```

## Troubleshooting

| Problem                                         | Cause                                                                      | Fix                                                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `JOSEError: Invalid key format`                 | The PEM file contains extra spaces or was pasted without quotes in `.env`. | Ensure the value in `.env` is wrapped in double quotes `"` and preserves the exact line breaks from the `.pem` file. |
| `ZodError: Expected string, received undefined` | The environment variables are missing entirely.                            | Double-check that the keys are named `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` in your `.env`.                          |

## Related

- [JWT Guide](../concepts/002-jwt-guide.md)
- [Architecture - Authentication Methods](../concepts/001-authentication-methods.md)
