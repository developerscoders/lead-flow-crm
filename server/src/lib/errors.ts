import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const Errors = {
  Unauthorized: (msg = "Authentication required") => new AppError(401, "UNAUTHORIZED", msg),
  Forbidden: (msg = "You do not have permission to perform this action") =>
    new AppError(403, "FORBIDDEN", msg),
  NotFound: (msg = "Resource not found") => new AppError(404, "NOT_FOUND", msg),
  BadRequest: (msg = "Invalid request") => new AppError(400, "BAD_REQUEST", msg),
  Conflict: (msg = "Conflict") => new AppError(409, "CONFLICT", msg),
  TooManyRequests: (msg = "Too many requests") => new AppError(429, "RATE_LIMITED", msg),
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten(),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

// Wraps async route handlers so thrown/rejected errors reach errorHandler.
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
