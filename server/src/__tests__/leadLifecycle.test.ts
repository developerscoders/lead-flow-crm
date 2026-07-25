import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, ensureMigrated, resetDb, closeDb, createUser, loginAs } from "./testUtils.js";

describe("core flow: full internal lifecycle (create -> assign -> note -> status -> activity trail)", () => {
  beforeAll(async () => {
    await ensureMigrated();
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("walks a lead through the entire pipeline and records every step in the activity trail", async () => {
    await createUser({ email: "admin@test.dev", password: "AdminPass1", role: "admin" });
    const member = await createUser({ email: "member@test.dev", password: "MemberPass1", role: "member" });
    const admin = await loginAs("admin@test.dev", "AdminPass1");

    // 1. Lead enters via the public form.
    await request(app).post("/api/public/leads").send({ name: "Ananya Roy", email: "ananya@example.com" });
    const list = await request(app).get("/api/leads").set("Cookie", admin.cookies);
    const leadId = list.body.data[0].id;

    // 2. Admin assigns it to a member.
    const assignRes = await request(app)
      .post(`/api/leads/${leadId}/assign`)
      .set("Cookie", admin.cookies)
      .set("x-csrf-token", admin.csrfToken)
      .send({ assignedToId: member.id });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.assignedToId).toBe(member.id);

    // 3. The member adds a note.
    const memberSession = await loginAs("member@test.dev", "MemberPass1");
    const noteRes = await request(app)
      .post(`/api/leads/${leadId}/notes`)
      .set("Cookie", memberSession.cookies)
      .set("x-csrf-token", memberSession.csrfToken)
      .send({ body: "Called and left a voicemail." });
    expect(noteRes.status).toBe(201);
    expect(noteRes.body.data.body).toBe("Called and left a voicemail.");
    expect(noteRes.body.data.createdAt).toBeTruthy();

    // 4. The member moves the lead through valid pipeline stages.
    const toContacted = await request(app)
      .post(`/api/leads/${leadId}/status`)
      .set("Cookie", memberSession.cookies)
      .set("x-csrf-token", memberSession.csrfToken)
      .send({ status: "contacted" });
    expect(toContacted.status).toBe(200);
    expect(toContacted.body.data.status).toBe("contacted");

    // Invalid transition (skipping stages) is rejected.
    const invalidJump = await request(app)
      .post(`/api/leads/${leadId}/status`)
      .set("Cookie", memberSession.cookies)
      .set("x-csrf-token", memberSession.csrfToken)
      .send({ status: "won" });
    expect(invalidJump.status).toBe(400);

    const toQualified = await request(app)
      .post(`/api/leads/${leadId}/status`)
      .set("Cookie", memberSession.cookies)
      .set("x-csrf-token", memberSession.csrfToken)
      .send({ status: "qualified" });
    expect(toQualified.status).toBe(200);

    // 5. Verify the full, ordered activity trail exists and is immutable/append-only.
    const detail = await request(app)
      .get(`/api/leads/${leadId}`)
      .set("Cookie", memberSession.cookies);

    const types = detail.body.data.activity.map((a: { type: string }) => a.type).sort();
    expect(types).toEqual(
      ["ASSIGNED", "LEAD_CREATED", "NOTE_ADDED", "STATUS_CHANGED", "STATUS_CHANGED"].sort()
    );
    expect(detail.body.data.notes).toHaveLength(1);
    expect(detail.body.data.status).toBe("qualified");
  });

  it("supports pagination and status/search filtering on the leads list", async () => {
    await createUser({ email: "admin@test.dev", password: "AdminPass1", role: "admin" });
    const admin = await loginAs("admin@test.dev", "AdminPass1");

    for (let i = 0; i < 15; i++) {
      await request(app)
        .post("/api/public/leads")
        .set("X-Forwarded-For", `10.0.0.${i + 1}`)
        .send({ name: `Bulk Lead ${i}`, email: `bulk${i}@example.com`, company: i % 2 === 0 ? "Acme" : "Globex" });
    }

    const page1 = await request(app)
      .get("/api/leads?page=1&pageSize=10")
      .set("Cookie", admin.cookies);
    expect(page1.body.data).toHaveLength(10);
    expect(page1.body.pagination).toMatchObject({ page: 1, pageSize: 10, total: 15, totalPages: 2 });

    const page2 = await request(app)
      .get("/api/leads?page=2&pageSize=10")
      .set("Cookie", admin.cookies);
    expect(page2.body.data).toHaveLength(5);

    const list = await request(app).get("/api/leads").set("Cookie", admin.cookies);
    const oneId = list.body.data[0].id;
    await request(app)
      .post(`/api/leads/${oneId}/status`)
      .set("Cookie", admin.cookies)
      .set("x-csrf-token", admin.csrfToken)
      .send({ status: "contacted" });

    const filtered = await request(app)
      .get("/api/leads?status=contacted")
      .set("Cookie", admin.cookies);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].id).toBe(oneId);

    const searched = await request(app)
      .get("/api/leads?q=Acme")
      .set("Cookie", admin.cookies);
    expect(searched.body.data.length).toBeGreaterThan(0);
    for (const lead of searched.body.data) {
      expect(lead.company).toBe("Acme");
    }
  });

  it("rejects an out-of-range page size with a validation error", async () => {
    await createUser({ email: "admin@test.dev", password: "AdminPass1", role: "admin" });
    const admin = await loginAs("admin@test.dev", "AdminPass1");
    const res = await request(app).get("/api/leads?pageSize=1000").set("Cookie", admin.cookies);
    expect(res.status).toBe(400);
  });
});
