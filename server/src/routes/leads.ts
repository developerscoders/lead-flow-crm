import { Router } from "express";
import { and, desc, asc, eq, ilike, or, isNull, count, SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { leads, notes, activities, users } from "../db/schema.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { csrfProtection } from "../middleware/auth.js";
import {
  addNoteSchema,
  assignLeadSchema,
  changeStatusSchema,
  listLeadsQuerySchema,
  updateLeadSchema,
  STATUS_TRANSITIONS,
} from "../lib/validation.js";
import { asyncHandler, Errors } from "../lib/errors.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

router.use(requireAuth, csrfProtection);

/**
 * Visibility rule: admins see every lead. Members see leads assigned to them
 * plus unassigned leads (so the team can self-pick new inbound leads), but
 * never leads assigned to a teammate. This is enforced at the query level,
 * not just hidden in the UI.
 */
function visibilityFilter(userId: number, role: "admin" | "member") {
  if (role === "admin") return undefined;
  return or(eq(leads.assignedToId, userId), isNull(leads.assignedToId));
}

async function getLeadOr404(id: number) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) throw Errors.NotFound("Lead not found");
  return lead;
}

function assertCanAccessLead(
  lead: { assignedToId: number | null },
  user: { sub: number; role: "admin" | "member" }
) {
  if (user.role === "admin") return;
  if (lead.assignedToId !== null && lead.assignedToId !== user.sub) {
    throw Errors.Forbidden("This lead is assigned to another team member");
  }
}

// GET /api/leads - paginated, filterable list
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listLeadsQuerySchema.parse(req.query);
    const user = req.user!;

    const conditions: (SQL | undefined)[] = [visibilityFilter(user.sub, user.role)];

    if (q.status) conditions.push(eq(leads.status, q.status));
    if (q.assignedToId !== undefined) conditions.push(eq(leads.assignedToId, q.assignedToId));
    if (q.q) {
      conditions.push(
        or(ilike(leads.name, `%${q.q}%`), ilike(leads.email, `%${q.q}%`), ilike(leads.company, `%${q.q}%`))
      );
    }

    const whereClause = and(...conditions.filter(Boolean));

    const sortColumn = q.sort.replace("-", "") as "createdAt" | "updatedAt";
    const sortDir = q.sort.startsWith("-") ? desc : asc;
    const orderBy = sortDir(leads[sortColumn]);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(leads)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ total: count() }).from(leads).where(whereClause),
    ]);

    res.json({
      data: rows,
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / q.pageSize) || 0,
      },
    });
  })
);

// GET /api/leads/:id - detail with notes + activity trail
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw Errors.BadRequest("Invalid lead id");

    const lead = await getLeadOr404(id);
    assertCanAccessLead(lead, req.user!);

    const [leadNotes, leadActivity] = await Promise.all([
      db.select().from(notes).where(eq(notes.leadId, id)).orderBy(desc(notes.createdAt)),
      db.select().from(activities).where(eq(activities.leadId, id)).orderBy(desc(activities.createdAt)),
    ]);

    res.json({ data: { ...lead, notes: leadNotes, activity: leadActivity } });
  })
);

// PATCH /api/leads/:id - update editable fields
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw Errors.BadRequest("Invalid lead id");

    const lead = await getLeadOr404(id);
    assertCanAccessLead(lead, req.user!);

    const patch = updateLeadSchema.parse(req.body);
    if (Object.keys(patch).length === 0) throw Errors.BadRequest("No fields to update");

    const [updated] = await db
      .update(leads)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();

    await logActivity({
      leadId: id,
      actorId: req.user!.sub,
      type: "FIELDS_UPDATED",
      metadata: patch,
    });

    res.json({ data: updated });
  })
);

// POST /api/leads/:id/assign - admin-only reassignment
router.post(
  "/:id/assign",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw Errors.BadRequest("Invalid lead id");

    await getLeadOr404(id);
    const { assignedToId } = assignLeadSchema.parse(req.body);

    if (assignedToId !== null) {
      const [target] = await db.select().from(users).where(eq(users.id, assignedToId)).limit(1);
      if (!target || !target.active) throw Errors.BadRequest("Target user does not exist or is inactive");
    }

    const [updated] = await db
      .update(leads)
      .set({ assignedToId, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();

    await logActivity({
      leadId: id,
      actorId: req.user!.sub,
      type: "ASSIGNED",
      metadata: { to: assignedToId },
    });

    res.json({ data: updated });
  })
);

// POST /api/leads/:id/status - move a lead through the pipeline
router.post(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw Errors.BadRequest("Invalid lead id");

    const lead = await getLeadOr404(id);
    assertCanAccessLead(lead, req.user!);

    const { status } = changeStatusSchema.parse(req.body);

    if (status !== lead.status) {
      const allowed = STATUS_TRANSITIONS[lead.status] || [];
      if (!allowed.includes(status)) {
        throw Errors.BadRequest(
          `Cannot move a lead from "${lead.status}" to "${status}"`
        );
      }
    }

    const [updated] = await db
      .update(leads)
      .set({ status, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();

    await logActivity({
      leadId: id,
      actorId: req.user!.sub,
      type: "STATUS_CHANGED",
      metadata: { from: lead.status, to: status },
    });

    res.json({ data: updated });
  })
);

// POST /api/leads/:id/notes - add a timestamped note
router.post(
  "/:id/notes",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw Errors.BadRequest("Invalid lead id");

    const lead = await getLeadOr404(id);
    assertCanAccessLead(lead, req.user!);

    const { body } = addNoteSchema.parse(req.body);

    const [note] = await db
      .insert(notes)
      .values({ leadId: id, authorId: req.user!.sub, body })
      .returning();

    await logActivity({ leadId: id, actorId: req.user!.sub, type: "NOTE_ADDED" });

    res.status(201).json({ data: note });
  })
);

export default router;
