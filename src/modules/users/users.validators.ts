import { z } from "zod";

export const UpdateProfileSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name cannot be empty")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    avatarUrl: z.url("avatarUrl must be a valid URL").max(2048).optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const DeleteAccountSchema = z
  .object({
    confirm: z.literal(true, {
      error: "You must confirm account deletion by setting confirm to true",
    }),
  })
  .strict();

export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;
