import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME, verifyAuthToken, type AuthTokenPayload } from "../lib/auth.js";
import { Errors } from "../lib/errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Requires a valid JWT in the httpOnly cookie. Populates req.user.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) return next(Errors.Unauthorized());

  try {
    req.user = verifyAuthToken(token);
  } catch {
    return next(Errors.Unauthorized("Session expired or invalid"));
  }
  next();
}

/**
 * Restricts access to one or more roles. Must run after requireAuth.
 */
export function requireRole(...roles: Array<"admin" | "member">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Errors.Unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(Errors.Forbidden());
    }
    next();
  };
}

/**
 * Double-submit CSRF check for state-changing requests (cookie-based auth is
 * vulnerable to CSRF, so we require the client to echo a value it could only
 * have read from its own cookie jar back in a custom header).
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(Errors.Forbidden("CSRF token missing or invalid"));
  }
  next();
}
