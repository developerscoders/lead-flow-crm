import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { loginSchema } from "../lib/validation.js";
import { verifyPassword } from "../lib/password.js";
import {
  signAuthToken,
  cookieOptions,
  csrfCookieOptions,
  randomCsrfToken,
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
} from "../lib/auth.js";
import { asyncHandler, Errors } from "../lib/errors.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Constant-shaped response whether the user exists or not, to avoid
    // leaking which emails are registered.
    if (!user || !user.active) {
      throw Errors.Unauthorized("Invalid email or password");
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw Errors.Unauthorized("Invalid email or password");
    }

    const token = signAuthToken({ sub: user.id, role: user.role, email: user.email });
    const csrfToken = randomCsrfToken();

    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
    res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions());

    res.json({
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  })
);

router.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
  res.status(204).send();
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.sub))
      .limit(1);

    if (!user) throw Errors.Unauthorized();

    res.json({
      data: { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    });
  })
);

export default router;
