import { ZodError } from "zod";
import { ValidationError } from "../errors/ValidationError";

export function parse<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown,
): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) throw ValidationError.fromZod(err);
    throw err;
  }
}
