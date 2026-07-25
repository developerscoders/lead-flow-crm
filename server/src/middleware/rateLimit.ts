import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

// Public capture form: strict, since it's unauthenticated and internet-facing.
// Always enforced at full strength (even in tests) — see leadLifecycle.test.ts
// for how bulk-seeding tests work around this with distinct source IPs.
export const publicFormLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many submissions. Try again shortly." } },
});

// Login: throttle brute-force attempts.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." } },
});

// General API: generous, but present.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isTest ? 5000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
});
