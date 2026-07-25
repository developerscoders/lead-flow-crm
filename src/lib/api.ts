// Small fetch wrapper for the external LeadFlow API.
// - Sends cookies (credentials: include)
// - Reads the leadflow_csrf cookie and attaches it as x-csrf-token on writes
// - Normalizes { data, pagination? } and { error: { code, message } }

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
console.log(BASE);
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

type Options = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
};

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Accept: "application/json" };

  let url = `${BASE}${path}`;
  if (opts.query) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") usp.append(k, String(v));
    }
    const qs = usp.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCookie("leadflow_csrf");
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;

  let payload: any = null;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { /* non-JSON */ }
  }

  if (!res.ok) {
    const err = payload?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "http_error",
      err?.message ?? `Request failed (${res.status})`,
    );
  }

  return payload as T;
}

export type Paginated<T> = {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type Envelope<T> = { data: T };

export type Role = "admin" | "member";
export type User = { id: string; name: string; email: string; role: Role };
export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  status: LeadStatus;
  assigneeId?: string | null;
  assignee?: User | null;
  createdAt: string;
  updatedAt?: string;
};

export type LeadNote = {
  id: string;
  body: string;
  authorId?: string;
  author?: { id: string; name: string } | null;
  createdAt: string;
};

export type LeadActivity = {
  id: string;
  type:
  | "LEAD_CREATED"
  | "ASSIGNED"
  | "STATUS_CHANGED"
  | "NOTE_ADDED"
  | "FIELDS_UPDATED";
  metadata?: Record<string, any>;
  createdAt: string;
  actor?: { id: string; name: string } | null;
};

export type LeadDetail = Lead & { notes: LeadNote[]; activity: LeadActivity[] };
