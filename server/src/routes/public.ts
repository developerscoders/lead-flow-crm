import { Router } from "express";
import { db } from "../db/client.js";
import { leads } from "../db/schema.js";
import { publicLeadCaptureSchema } from "../lib/validation.js";
import { asyncHandler, Errors } from "../lib/errors.js";
import { publicFormLimiter } from "../middleware/rateLimit.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

router.post(
  "/leads",
  publicFormLimiter,
  asyncHandler(async (req, res) => {
    const parsed = publicLeadCaptureSchema.parse(req.body);

    // Honeypot: if a bot filled the hidden "website" field, silently pretend success.
    if (parsed.website) {
      return res.status(201).json({ data: { received: true } });
    }

    const [lead] = await db
      .insert(leads)
      .values({
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone || null,
        company: parsed.company || null,
        message: parsed.message || null,
        source: "public_form",
        status: "new",
      })
      .returning();

    if (!lead) throw Errors.BadRequest("Could not create lead");

    await logActivity({ leadId: lead.id, actorId: null, type: "LEAD_CREATED" });

    res.status(201).json({ data: { received: true } });
  })
);

export default router;
