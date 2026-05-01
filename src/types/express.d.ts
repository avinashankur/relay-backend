import type { UserRole } from "@/generated/prisma/enums";

export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        sessionId: string;
      };
    }
  }
}
