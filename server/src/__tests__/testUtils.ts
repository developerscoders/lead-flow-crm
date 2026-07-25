import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../lib/password.js";
import request from "supertest";
import { createApp } from "../app.js";

export const app = createApp();

let migrated = false;

export async function ensureMigrated() {
  if (migrated) return;
  await migrate(db, { migrationsFolder: "./drizzle" });
  migrated = true;
}

/** Truncates all app tables and resets identity sequences between tests. */
export async function resetDb() {
  await db.execute(
    sql`TRUNCATE TABLE activities, notes, leads, users RESTART IDENTITY CASCADE`
  );
}

export async function closeDb() {
  await pool.end();
}

export async function createUser(opts: {
  name?: string;
  email: string;
  password: string;
  role: "admin" | "member";
}) {
  const passwordHash = await hashPassword(opts.password);
  const [user] = await db
    .insert(users)
    .values({
      name: opts.name || opts.email,
      email: opts.email,
      passwordHash,
      role: opts.role,
    })
    .returning();
  return user!;
}

/** Logs in via the real HTTP endpoint and returns cookies + csrf token for reuse. */
export async function loginAs(email: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  const setCookie = res.headers["set-cookie"] as unknown as string[];
  const cookies = setCookie.join("; ");
  const csrfCookie = setCookie.find((c) => c.startsWith("leadflow_csrf="));
  const csrfToken = csrfCookie?.split(";")[0].split("=")[1];
  return { res, cookies, csrfToken: csrfToken || "" };
}
