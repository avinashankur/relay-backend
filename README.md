# Relay

Relay is a Node.js backend service built with TypeScript, Express, and Prisma. It provides a robust architecture for user authentication, session management, and related services.

## Features

- **Authentication**: Multiple strategies including password and OTP.
- **Session Management**: Secure session handling and cleanup via background workers.
- **User Management**: User profiles and administration endpoints.
- **Database**: PostgreSQL with Prisma ORM for type-safe database access.
- **Caching & Background Jobs**: Redis integration for caching, rate-limiting, and processing background tasks (e.g., email sending, session cleanup).
- **Email Generation**: Email templates built with React (`.tsx`).

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL (assumed based on `pg` types)
- **Testing**: Jest & Supertest
- **Background Processing**: Redis / Custom Workers

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Redis

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables. Create a `.env` file based on the required configuration.
4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

### Running the Application

- **Development Mode**:
  ```bash
  npm run dev
  ```
- **Production Build**:
  ```bash
  npm run build
  npm start
  ```

### Testing

Run the test suite using Jest:

```bash
npm run test
```

## Project Structure

- `src/modules/` - Feature-based modules (auth, users, sessions, admin).
- `src/shared/` - Shared utilities, services, middleware, and errors.
- `src/workers/` - Background job processors.
- `src/emails/` - React-based email templates.
- `docs/` - Architecture and system design documentation.

## License

ISC
