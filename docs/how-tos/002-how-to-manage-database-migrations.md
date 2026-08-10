# How to Manage Database Migrations

> **Audience:** Backend Developers, DevOps
> **Time required:** 5-10 minutes
> **Last verified:** 2026-08-09

## Prerequisites

- Node.js installed (`npm install` has been run)
- Local PostgreSQL database running (`docker-compose up -d postgres`)
- `.env` file contains a valid `DATABASE_URL`
- Basic familiarity with Prisma ORM

## Steps: Local Development (Changing the Schema)

Follow these steps when you are actively developing and need to modify the database schema (e.g., adding a new column to a table).

### 1. Update the Prisma Schema

Open `prisma/schema.prisma` and make your desired changes to the models.

```prisma
// Example addition:
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  // Added a new field:
  lastLogin DateTime?
}
```

### 2. Generate and Apply the Migration

Run the Prisma migration command. This creates a new SQL migration file in `prisma/migrations/` and applies it to your local database.

```bash
npx prisma migrate dev --name add_last_login_field
```

Expected result:

```text
Your database is now in sync with your schema.
Generated Prisma Client (v5.x) to ./node_modules/@prisma/client
```

### 3. Verify Prisma Client Updates

The `migrate dev` command automatically runs `prisma generate`, which updates the TypeScript types. Ensure your code compiles successfully with the new types.

```bash
npm run typecheck
```

Expected result: Clean output with no type errors.

## Steps: Production (Deploying Schema Changes)

When your code is deployed to production, or you are running in a CI/CD environment, you **never** run `migrate dev`. Instead, you only apply the pre-generated migration files.

### 1. Build Phase: Generate the Client

During the build step of your Docker container or CI pipeline, generate the Prisma Client using the existing schema.

```bash
npx prisma generate
```

### 2. Release Phase: Apply Migrations

Before the new API containers start serving traffic, run the deployment command. This applies any pending migrations in `prisma/migrations/` to the production database.

```bash
npx prisma migrate deploy
```

Expected result:

```text
X migrations found in prisma/migrations
Applying migration `20260809123456_add_last_login_field`
The migrations have been successfully applied.
```

## Verify it worked

Check the status of your migrations to ensure the database is fully in sync.

```bash
npx prisma migrate status
```

Expected result:

```text
Database schema is up to date!
```

## Troubleshooting

| Problem                                                          | Cause                                                                          | Fix                                                                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `P3014: Prisma Migrate could not create the shadow database.`    | The user connecting to PostgreSQL doesn't have privileges to create databases. | Ensure the local `DATABASE_URL` connects with a superuser (e.g., `postgres`), or use a cloud provider that allows shadow databases.      |
| `P3009: migrate found failed migrations in the target database`  | A previous migration failed halfway through execution.                         | Resolve the database error manually via SQL, then mark it as resolved using `npx prisma migrate resolve --rolled-back <migration_name>`. |
| `Type error: Property 'lastLogin' does not exist on type 'User'` | The Prisma Client was not regenerated after pulling code from Git.             | Run `npx prisma generate` to update the local TypeScript definitions.                                                                    |

## Related

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [How to run Docker locally](./how-to-run-docker.md)
