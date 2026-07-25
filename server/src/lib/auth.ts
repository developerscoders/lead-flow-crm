import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export type AuthTokenPayload = {
  sub: number;
  role: "admin" | "member";
  email: string;
};

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as AuthTokenPayload;
}

export const AUTH_COOKIE_NAME = "leadflow_token";
export const CSRF_COOKIE_NAME = "leadflow_csrf";

export function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: "/",
  };
}

export function csrfCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: false, // must be readable by client JS to echo back in header
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: "/",
  };
}

export function randomCsrfToken(): string {
  // Not cryptographically sensitive beyond unpredictability; fine for double-submit pattern.
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
