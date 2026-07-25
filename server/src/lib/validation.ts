import { z } from "zod";

export const leadStatusValues = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
] as const;

// Allowed forward/lateral transitions in the pipeline. "lost" is reachable from
// any active stage; "won" only from proposal/qualified; nothing leaves won/lost.
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["proposal", "lost"],
  proposal: ["won", "lost"],
  won: [],
  lost: [],
};

export const publicLeadCaptureSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot field: real users never fill this in (it's hidden via CSS on the
  // form); bots that auto-fill every input often do. Any non-empty value here
  // marks the submission as bot traffic without ever surfacing a validation
  // error to the caller.
  website: z.string().max(500).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  role: z.enum(["admin", "member"]),
});

export const updateLeadSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  company: z.string().trim().max(160).nullable().optional(),
  message: z.string().trim().max(2000).nullable().optional(),
});

export const assignLeadSchema = z.object({
  assignedToId: z.number().int().positive().nullable(),
});

export const changeStatusSchema = z.object({
  status: z.enum(leadStatusValues),
});

export const addNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(leadStatusValues).optional(),
  assignedToId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(["createdAt", "-createdAt", "updatedAt", "-updatedAt"]).default("-createdAt"),
});
