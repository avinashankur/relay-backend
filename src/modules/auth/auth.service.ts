import type { PrismaClient, User } from "../../generated/prisma/client.js";
import { ValidationError } from "../../shared/errors/ValidationError.js";
import type { SignupInput } from "./auth.validators";
import type { PasswordStrategy } from "./strategies/password.strategy.js";

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private passwordStrategy: PasswordStrategy,
  ) {}

  async signup(input: SignupInput): Promise<User> {
    // check if the email already exists in our db
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    // if it already exists then throw a validation error
    if (existing) {
      throw new ValidationError(
        "EMAIL_TAKEN",
        "An account with this email already exists.",
      );
    }

    // otherwise hash the password first and store the user in db
    const credentialHash = await this.passwordStrategy.hash(input.password);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        authAccounts: {
          create: {
            provider: "password",
            credential: credentialHash,
          },
        },
      },
    });

    // TODO: generate email verification token, store hash in redis

    return user;
  }
}
