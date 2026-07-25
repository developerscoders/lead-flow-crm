import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { requireAuth, requireRole, csrfProtection } from "../middleware/auth.js";
import { createUserSchema } from "../lib/validation.js";
import { asyncHandler, Errors } from "../lib/errors.js";
import { hashPassword } from "../lib/password.js";

const router = Router();

router.use(requireAuth, csrfProtection);

// GET /api/users - any authenticated user (needed to render assignee names/dropdowns)
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active })
      .from(users);
    res.json({ data: rows });
  })
);

// POST /api/users - admin-only account creation
router.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const input = createUserSchema.parse(req.body);

    const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existing) throw Errors.Conflict("A user with that email already exists");

    const passwordHash = await hashPassword(input.password);
    const [created] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash, role: input.role })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

    res.status(201).json({ data: created });
  })
);

export default router;
