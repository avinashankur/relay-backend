import { z } from "zod";

// DELETE /sessions/:id
export const RevokeSessionSchema = z.object({
  id: z.string().cuid({ message: "Invalid session ID" }),
});

// GET /sessions?cursor=&limit=
export const ListSessionsQuerySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export type RevokeSessionParams = z.infer<typeof RevokeSessionSchema>;
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;
