import { db } from "../db/client.js";
import { activities } from "../db/schema.js";

type ActivityType =
  | "LEAD_CREATED"
  | "ASSIGNED"
  | "STATUS_CHANGED"
  | "NOTE_ADDED"
  | "FIELDS_UPDATED";

/**
 * Records an immutable activity trail entry. Called from within a service/route
 * after the underlying mutation succeeds. Entries are never updated or deleted.
 */
export async function logActivity(params: {
  leadId: number;
  actorId: number | null;
  type: ActivityType;
  metadata?: Record<string, unknown> | null;
}) {
  await db.insert(activities).values({
    leadId: params.leadId,
    actorId: params.actorId,
    type: params.type,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
  });
}
