import z from "zod";

// Shared primitives
const emailSchema = z.email().toLowerCase().trim();

const passwordSchema = z
  .string({ error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

const tokenSchema = z
  .string({ error: "Token is required" })
  .min(1, "Token cannot be empty")
  .trim();

// signup
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: z
      .string({ error: "Name is required." })
      .min(1, "Name cannot be empty.")
      .max(100, "Name must be at most 100 characters.")
      .trim(),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;

// login
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string({ error: "Password is required." })
      .min(1, "Password cannot be empty."),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

// magic link
export const magicLinkRequestSchema = z
  .object({
    email: emailSchema,
    /**
     * The frontend URL the user should land on after clicking the link.
     * Must be an absolute URL. Validated to prevent open-redirect attacks
     * — the service layer will also verify this against an allowlist.
     */
    redirectUrl: z.string().default("/"),
  })
  .strict();

export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestSchema>;

export const magicLinkCallbackQuerySchema = z
  .object({
    token: tokenSchema,
  })
  .strict();

export type MagicLinkCallbackQueryInput = z.infer<
  typeof magicLinkCallbackQuerySchema
>;

// otp schema
export const otpRequestSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type otpRequestInput = z.infer<typeof otpRequestSchema>;

// otp verify schema
export const otpVerifySchema = z
  .object({
    email: emailSchema,
    code: z
      .string({ error: "OTP code is required" })
      .min(1, "OTP code cannot be empty")
      .trim(),
  })
  .strict();

export type otpVerifyInput = z.infer<typeof otpVerifySchema>;

// OAuth
export const oauthProviderSchema = z.enum(["google", "github"], {
  error: "Unsupported OAuth provider",
});

export type OAuthProviderInput = z.infer<typeof oauthProviderSchema>;

export const oauthCallbackQuerySchema = z
  .object({
    code: z
      .string({ error: "Authorization code is required" })
      .min(1, "Authorization code cannot be empty"),
    state: z
      .string({ error: "State parameter is required" })
      .min(1, "State cannot be empty"),
  })
  .strict();

export type OAuthCallbackQueryType = z.infer<typeof oauthCallbackQuerySchema>;

// Password reset
export const passwordResetRequestSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;

export const passwordResetSchema = z
  .object({
    token: tokenSchema,
    newPassword: passwordSchema,
  })
  .strict();

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

// Email Verification
export const emailVerifySchema = z
  .object({
    token: tokenSchema,
  })
  .strict();

export type EmailVerifyInput = z.infer<typeof emailVerifySchema>;

export const emailVerifyQuerySchema = z
  .object({
    token: tokenSchema,
  })
  .strict();

export type EmailVerifyQueryInput = z.infer<typeof emailVerifyQuerySchema>;

// Resend Verification Email
export const resendVerificationSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
