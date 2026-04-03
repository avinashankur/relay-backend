import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { failure, failureFromError } from "../utils/response";
import { logger } from "@/config/logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(failureFromError(err));
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json(failure("INTERNAL_ERROR", "Something went wrong"));
}
