# Stage 1 — deps: install ALL dependencies (dev + prod) for the build step
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# Stage 2 — builder: compile TypeScript
FROM deps AS builder

WORKDIR /app

COPY . .

# Prisma 7: prisma.config.ts uses env("DATABASE_URL") which is evaluated when
# the config module loads — even during `prisma generate` which never connects
# to a database. We satisfy it with a build-time ARG so the value never leaks
# into a committed layer and Prisma's env() helper does not throw.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate

RUN npm run build

# Stage 3 — runtime: lean production image for the API process
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Prisma 7: datasource url lives in prisma.config.ts, not schema.prisma.
# Both the schema and config file must be present for CLI commands
# (prisma migrate deploy) to resolve DATABASE_URL at container runtime.
COPY prisma ./prisma
COPY prisma.config.ts ./

# Re-generate Prisma client against the production node_modules.
# DATABASE_URL is supplied via the same ARG pattern as the builder stage.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate

EXPOSE 5000

# Migrations are intentionally NOT run here. Run `npx prisma migrate deploy`
# as a separate step in your deployment pipeline before updating this container.
CMD ["node", "dist/server.js"]
