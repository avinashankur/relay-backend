import z from "zod";

// Shared primitives ——————————————————————————————————————————————————————————
const emailSchema = z.email().toLowerCase().trim();

const passwordSchema = z
  .string({ error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

const tokenSchema = z
  .string({ error: "Token is required" })
  .min(1, "Token cannot be empty")
  .trim();

const redirectUrlSchema = z.url("Invalid redirect URL").optional();

// signup —————————————————————————————————————————————————————————————————————————
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string({ error: "Name is required." })
    .min(1, "Name cannot be empty.")
    .max(100, "Name must be at most 100 characters.")
    .trim(),
});

export type SignupInput = z.infer<typeof signupSchema>;

// login —————————————————————————————————————————————————————————————————————————————
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Password is required." })
    .min(1, "Password cannot be empty."),
});

export type LoginInput = z.infer<typeof loginSchema>;

// magic link ——————————————————————————————————————————————————————————————————————————
export const magicLinkRequestSchema = z.object({
  email: emailSchema,
  /**
   * The frontend URL the user should land on after clicking the link.
   * Must be an absolute URL. Validated to prevent open-redirect attacks
   * — the service layer will also verify this against an allowlist.
   */
  redirectUrl: redirectUrlSchema,
});

export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestSchema>;

// otp schema ——————————————————————————————————————————————————————————————————————————
export const otpRequestSchema = z.object({
  email: emailSchema,
});

export type otpRequestInput = z.infer<typeof otpRequestSchema>;

// OAuth ————————————————————————————————————————————————————————————————————————————————
export const oauthProviderSchema = z.enum(["google", "github"], {
  error: "Unsupported OAuth provider",
});

export type OAuthProviderInput = z.infer<typeof oauthProviderSchema>;

export const OAuthCallbackQuerySchema = z.object({
  code: z
    .string({ error: "Authorization code is required" })
    .min(1, "Authorization code cannot be empty"),
  state: z
    .string({ error: "State parameter is required" })
    .min(1, "State cannot be empty"),
});

export type OAuthCallbackQueryType = z.infer<typeof OAuthCallbackQuerySchema>;

// Password reset —————————————————————————————————————————————————————————————————————————
export const PasswordResetRequestSchema = z.object({
  email: emailSchema,
});

export type PasswordResetRequestInput = z.infer<
  typeof PasswordResetRequestSchema
>;

// Email Verification ————————————————————————————————————————————————————————————————————
export const EmailVerifySchema = z.object({
  token: tokenSchema,
});

export type EmailVerifyInput = z.infer<typeof EmailVerifySchema>;
