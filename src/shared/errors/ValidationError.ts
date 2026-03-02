import { ZodError, type ZodIssue } from "zod";
import { AppError } from "./AppError";

export interface FieldError {
  field: string;
  message: string;
}

/**
 * 422 Unprocessable Entity — request is well-formed but fails validation.
 *
 * Use for:
 *   - Zod schema violations on request bodies / query params
 *   - Business-rule violations (e.g. email already taken, OAuth account conflict)
 */
export class ValidationError extends AppError {
  readonly fields?: FieldError[];

  constructor(
    code: ValidationErrorCode,
    message: string,
    fields?: FieldError[],
  ) {
    super(422, code, message);
    this.fields = fields;
  }

  /**
   * Build a ValidationError from a ZodError, extracting per-field messages.
   */
  static fromZod(error: ZodError): ValidationError {
    const fields: FieldError[] = error.issues.map((issue: ZodIssue) => ({
      field: issue.path.join(".") || "_root",
      message: issue.message,
    }));

    return new ValidationError(
      "VALIDATION_FAILED",
      "Request validation failed",
      fields,
    );
  }
}

export type ValidationErrorCode =
  | "VALIDATION_FAILED" // Zod schema violation
  | "EMAIL_TAKEN" // signup with already-registered email
  | "OAUTH_ACCOUNT_CONFLICT" // OAuth account already linked to a different user
  | "WEAK_PASSWORD" // password does not meet strength requirements
  | "INVALID_ROLE" // role value not in enum
  | "INVALID_PROVIDER"; // OAuth provider not supported
