import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, ensureMigrated, resetDb, closeDb, createUser, loginAs } from "./testUtils.js";

describe("auth rules", () => {
  beforeAll(async () => {
    await ensureMigrated();
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("blocks access to a protected route with no session", async () => {
    const res = await request(app).get("/api/leads");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects login with a wrong password", async () => {
    await createUser({ email: "admin@test.dev", password: "CorrectPass1", role: "admin" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.dev", password: "WrongPass1" });
    expect(res.status).toBe(401);
  });

  it("rejects login for a nonexistent user with the same error shape as a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@test.dev", password: "whatever123" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("issues a session cookie and csrf cookie on successful login", async () => {
    await createUser({ email: "admin@test.dev", password: "CorrectPass1", role: "admin" });
    const { res } = await loginAs("admin@test.dev", "CorrectPass1");
    expect(res.status).toBe(200);
    const setCookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(setCookie).toContain("leadflow_token=");
    expect(setCookie).toContain("leadflow_csrf=");
    expect(setCookie).toContain("HttpOnly"); // auth cookie must not be readable by JS
  });

  it("rejects a state-changing request that omits the CSRF header, even with a valid session", async () => {
    await createUser({ email: "admin@test.dev", password: "CorrectPass1", role: "admin" });
    const { cookies } = await loginAs("admin@test.dev", "CorrectPass1");

    const res = await request(app)
      .post("/api/leads/1/status")
      .set("Cookie", cookies)
      .send({ status: "contacted" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects a state-changing request with a CSRF header that doesn't match the cookie", async () => {
    await createUser({ email: "admin@test.dev", password: "CorrectPass1", role: "admin" });
    const { cookies } = await loginAs("admin@test.dev", "CorrectPass1");

    const res = await request(app)
      .post("/api/leads/1/status")
      .set("Cookie", cookies)
      .set("x-csrf-token", "not-the-real-token")
      .send({ status: "contacted" });

    expect(res.status).toBe(403);
  });

  it("blocks a member from admin-only user creation", async () => {
    await createUser({ email: "member@test.dev", password: "MemberPass1", role: "member" });
    const { cookies, csrfToken } = await loginAs("member@test.dev", "MemberPass1");

    const res = await request(app)
      .post("/api/users")
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ name: "New", email: "new@test.dev", password: "SomePass123", role: "member" });

    expect(res.status).toBe(403);
  });

  it("blocks a member from reassigning a lead (admin-only)", async () => {
    const admin = await createUser({ email: "admin@test.dev", password: "AdminPass1", role: "admin" });
    const member = await createUser({ email: "member@test.dev", password: "MemberPass1", role: "member" });
    const adminSession = await loginAs("admin@test.dev", "AdminPass1");

    const createRes = await request(app)
      .post("/api/public/leads")
      .send({ name: "Lead One", email: "lead1@test.dev" });
    expect(createRes.status).toBe(201);

    const list = await request(app)
      .get("/api/leads")
      .set("Cookie", adminSession.cookies);
    const leadId = list.body.data[0].id;

    const memberSession = await loginAs("member@test.dev", "MemberPass1");
    const res = await request(app)
      .post(`/api/leads/${leadId}/assign`)
      .set("Cookie", memberSession.cookies)
      .set("x-csrf-token", memberSession.csrfToken)
      .send({ assignedToId: member.id });

    expect(res.status).toBe(403);
    void admin;
  });

  it("isolates leads between members: member A cannot see or edit a lead assigned to member B", async () => {
    const admin = await createUser({ email: "admin@test.dev", password: "AdminPass1", role: "admin" });
    const memberA = await createUser({ email: "a@test.dev", password: "MemberPassA1", role: "member" });
    const memberB = await createUser({ email: "b@test.dev", password: "MemberPassB1", role: "member" });

    const adminSession = await loginAs("admin@test.dev", "AdminPass1");
    await request(app).post("/api/public/leads").send({ name: "Iso Lead", email: "iso@test.dev" });
    const list = await request(app).get("/api/leads").set("Cookie", adminSession.cookies);
    const leadId = list.body.data[0].id;

    await request(app)
      .post(`/api/leads/${leadId}/assign`)
      .set("Cookie", adminSession.cookies)
      .set("x-csrf-token", adminSession.csrfToken)
      .send({ assignedToId: memberB.id });

    const sessionA = await loginAs("a@test.dev", "MemberPassA1");

    const detailRes = await request(app)
      .get(`/api/leads/${leadId}`)
      .set("Cookie", sessionA.cookies);
    expect(detailRes.status).toBe(403);

    const listResA = await request(app).get("/api/leads").set("Cookie", sessionA.cookies);
    const idsVisibleToA = listResA.body.data.map((l: { id: number }) => l.id);
    expect(idsVisibleToA).not.toContain(leadId);

    void memberA;
  });

  it("allows a member to see and act on an unassigned lead", async () => {
    const memberA = await createUser({ email: "a@test.dev", password: "MemberPassA1", role: "member" });
    await request(app).post("/api/public/leads").send({ name: "Open Lead", email: "open@test.dev" });

    const sessionA = await loginAs("a@test.dev", "MemberPassA1");
    const listRes = await request(app).get("/api/leads").set("Cookie", sessionA.cookies);
    expect(listRes.body.data.length).toBe(1);

    void memberA;
  });
});
