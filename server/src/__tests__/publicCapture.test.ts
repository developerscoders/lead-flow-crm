import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, ensureMigrated, resetDb, closeDb, createUser, loginAs } from "./testUtils.js";

describe("core flow: public capture -> lead created", () => {
  beforeAll(async () => {
    await ensureMigrated();
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("creates a lead from the public form and logs a LEAD_CREATED activity, without leaking internal data to the public caller", async () => {
    const captureRes = await request(app).post("/api/public/leads").send({
      name: "Ravi Kumar",
      email: "ravi.kumar@example.com",
      phone: "+91 98765 43210",
      company: "Kumar Traders",
      message: "Please call me back.",
    });

    expect(captureRes.status).toBe(201);
    // Public response must not expose the lead id or internal record shape.
    expect(captureRes.body).toEqual({ data: { received: true } });

    const admin = await createUser({ email: "admin@test.dev", password: "AdminPass1", role: "admin" });
    const { cookies } = await loginAs("admin@test.dev", "AdminPass1");

    const listRes = await request(app).get("/api/leads").set("Cookie", cookies);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0]).toMatchObject({
      name: "Ravi Kumar",
      email: "ravi.kumar@example.com",
      status: "new",
      source: "public_form",
      assignedToId: null,
    });

    const leadId = listRes.body.data[0].id;
    const detailRes = await request(app).get(`/api/leads/${leadId}`).set("Cookie", cookies);
    expect(detailRes.body.data.activity).toHaveLength(1);
    expect(detailRes.body.data.activity[0].type).toBe("LEAD_CREATED");
    expect(detailRes.body.data.activity[0].actorId).toBeNull();

    void admin;
  });

  it("rejects a malformed public submission with 400 and validation details", async () => {
    const res = await request(app).post("/api/public/leads").send({ name: "", email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("silently accepts but discards honeypot-triggered bot submissions", async () => {
    const res = await request(app)
      .post("/api/public/leads")
      .send({ name: "Bot", email: "bot@example.com", website: "http://spam.example" });
    expect(res.status).toBe(201);

    const admin = await createUser({ email: "admin@test.dev", password: "AdminPass1", role: "admin" });
    const { cookies } = await loginAs("admin@test.dev", "AdminPass1");
    const listRes = await request(app).get("/api/leads").set("Cookie", cookies);
    expect(listRes.body.data).toHaveLength(0);
  });

  it("rate-limits rapid-fire public submissions", async () => {
    const results = [];
    for (let i = 0; i < 7; i++) {
      results.push(
        await request(app)
          .post("/api/public/leads")
          .send({ name: `Lead ${i}`, email: `lead${i}@example.com` })
      );
    }
    const statuses = results.map((r) => r.status);
    expect(statuses).toContain(429);
  });
});
