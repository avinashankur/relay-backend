import { jest } from "@jest/globals";
import request from "supertest";
import { createApp, type AppInstance } from "@/app";
import { redis, connectRedis } from "@/config/redis";
import { prisma } from "@/config/prisma";
import { emailQueue, EmailJobName } from "@/workers/email/email.queue";
import type { SendVerificationJobData } from "@/workers/email/email.queue";

const TEST_EMAIL_PREFIX = "relay-auth-it-";
const PASSWORD = "StrongPass1!";

jest.setTimeout(30000);

function uniqueEmail(): string {
  return `${TEST_EMAIL_PREFIX}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;
}

function cookieHeader(response: request.Response, name: string): string {
  const rawCookies = response.headers["set-cookie"];
  const cookies = Array.isArray(rawCookies)
    ? rawCookies
    : rawCookies
      ? [rawCookies]
      : [];
  const cookie = cookies?.find((value: string) => value.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Missing ${name} cookie`);
  }

  return cookie.split(";")[0];
}

async function findVerificationToken(
  email: string,
): Promise<{ token: string; jobId?: string }> {
  const jobs = await emailQueue.getJobs(
    ["waiting", "delayed", "prioritized", "paused"],
    0,
    100,
    false,
  );

  const job = jobs.find(
    (candidate) =>
      candidate.name === EmailJobName.SendVerification &&
      (candidate.data as SendVerificationJobData).email === email,
  );

  if (!job) {
    throw new Error(`Missing verification email job for ${email}`);
  }

  return {
    token: (job.data as SendVerificationJobData).token,
    jobId: job.id,
  };
}

async function removeVerificationJob(jobId: string | undefined): Promise<void> {
  if (!jobId) return;

  const job = await emailQueue.getJob(jobId);
  if (job) await job.remove();
}

async function cleanupTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: TEST_EMAIL_PREFIX,
      },
    },
  });
}

async function cleanupRedisState(): Promise<void> {
  const keys = await redis.keys("rl:*");
  if (keys.length > 0) {
    await redis.del(keys);
  }

  await redis.del("audit:buffer");
}

describe("auth integration", () => {
  let instance: AppInstance;

  beforeAll(async () => {
    if (!redis.isOpen) await connectRedis();
    instance = createApp();
    await cleanupTestUsers();
    await cleanupRedisState();
  });

  afterEach(async () => {
    await cleanupTestUsers();
    await cleanupRedisState();
  });

  afterAll(async () => {
    clearInterval(instance.auditFlushInterval);
    await cleanupTestUsers();
    await cleanupRedisState();
    await emailQueue.close();
    await prisma.$disconnect();
    if (redis.isOpen) await redis.quit();
  });

  it("signs up a user, stores the session, queues verification, and verifies email", async () => {
    const email = uniqueEmail();

    const signup = await request(instance.app)
      .post("/api/v1/auth/signup")
      .set("Content-Type", "application/json")
      .send({ email, password: PASSWORD, name: "Integration User" })
      .expect(201);

    expect(signup.body).toMatchObject({
      success: true,
      data: {
        user: {
          email,
          emailVerified: false,
        },
      },
    });
    expect(cookieHeader(signup, "access_token")).toMatch(/^access_token=.+/);
    expect(cookieHeader(signup, "refresh_token")).toMatch(/^refresh_token=.+/);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { authAccounts: true, sessions: true },
    });
    expect(user.authAccounts).toHaveLength(1);
    expect(user.sessions).toHaveLength(1);

    const { token, jobId } = await findVerificationToken(email);

    const verify = await request(instance.app)
      .get("/api/v1/auth/verify-email")
      .query({ token })
      .expect(200);

    expect(verify.body).toEqual({ success: true, data: null });

    const verifiedUser = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(verifiedUser.emailVerified).toBe(true);

    await removeVerificationJob(jobId);
  });

  it("logs in with password and refreshes the session using the refresh cookie", async () => {
    const email = uniqueEmail();

    await request(instance.app)
      .post("/api/v1/auth/signup")
      .set("Content-Type", "application/json")
      .send({ email, password: PASSWORD, name: "Refresh User" })
      .expect(201);
    const signupVerification = await findVerificationToken(email);
    await removeVerificationJob(signupVerification.jobId);

    const login = await request(instance.app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send({ email, password: PASSWORD })
      .expect(200);

    expect(login.body).toMatchObject({
      success: true,
      data: {
        user: { email },
      },
    });

    const refreshCookie = cookieHeader(login, "refresh_token");

    const refresh = await request(instance.app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie)
      .expect(200);

    expect(refresh.body).toEqual({
      success: true,
      data: "Token refreshed successfully",
    });
    expect(cookieHeader(refresh, "access_token")).toMatch(/^access_token=.+/);
    expect(cookieHeader(refresh, "refresh_token")).toMatch(/^refresh_token=.+/);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { sessions: true },
    });
    expect(user.sessions).toHaveLength(2);
  });
});
