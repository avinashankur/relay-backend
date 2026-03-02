import type { Response } from 'express';
import type { AppError } from '../errors/AppError';
import type { FieldError } from '../errors/ValidationError';

// =============================================================================
// Envelope types
// =============================================================================

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: FieldError[]; // only present on 422 ValidationError
  };
}

export type ApiResponse<T> = SuccessEnvelope<T> | ErrorEnvelope;

// =============================================================================
// Success helper
// =============================================================================

/**
 * Wrap data in the standard success envelope.
 *
 * Usage:
 *   res.status(200).json(success({ user }));
 *   res.status(201).json(success({ userId }));
 *   res.status(200).json(success(null));  // for void operations
 */
export function success<T>(data: T): SuccessEnvelope<T> {
  return { success: true, data };
}

// =============================================================================
// Error helpers
// =============================================================================

/**
 * Wrap an error in the standard error envelope.
 * Includes `fields` if the error is a ValidationError with field-level details.
 */
export function failure(code: string, message: string, fields?: FieldError[]): ErrorEnvelope {
  return {
    success: false,
    error: {
      code,
      message,
      ...(fields && fields.length > 0 ? { fields } : {}),
    },
  };
}

/**
 * Build an ErrorEnvelope from an AppError instance.
 * Reads `fields` off ValidationError via duck-typing — no circular import needed.
 */
export function failureFromError(err: AppError): ErrorEnvelope {
  const fields = (err as { fields?: FieldError[] }).fields;
  return failure(err.code, err.message, fields);
}

// =============================================================================
// Send helpers — write directly to the Express response
// =============================================================================

/**
 * Send a success response with the given status code and data.
 *
 * Usage:
 *   return sendSuccess(res, 201, { userId });
 */
export function sendSuccess<T>(res: Response, statusCode: number, data: T): void {
  res.status(statusCode).json(success(data));
}

/**
 * Send an error response derived from an AppError.
 * Delegates status code resolution to the error itself.
 */
export function sendError(res: Response, err: AppError): void {
  res.status(err.statusCode).json(failureFromError(err));
}