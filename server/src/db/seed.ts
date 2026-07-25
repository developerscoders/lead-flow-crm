import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, pool } from "./client.js";
import { users, leads, notes, activities } from "./schema.js";

async function main() {
  const adminPassHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD || "Admin#12345",
    12
  );
  const memberPassHash = await bcrypt.hash(
    process.env.SEED_MEMBER_PASSWORD || "Member#12345",
    12
  );

  const [admin] = await db
    .insert(users)
    .values({
      name: "Admin User",
      email: process.env.SEED_ADMIN_EMAIL || "admin@leadflow.dev",
      passwordHash: adminPassHash,
      role: "admin",
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const [member] = await db
    .insert(users)
    .values({
      name: "Member User",
      email: process.env.SEED_MEMBER_EMAIL || "member@leadflow.dev",
      passwordHash: memberPassHash,
      role: "member",
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const adminId = admin?.id;
  const memberId = member?.id;

  if (adminId && memberId) {
    const [lead] = await db
      .insert(leads)
      .values({
        name: "Priya Sharma",
        email: "priya.sharma@example.com",
        phone: "+91 90000 12345",
        company: "Sharma Textiles",
        source: "public_form",
        message: "Interested in a demo of the platform.",
        status: "new",
        assignedToId: memberId,
        createdById: null,
      })
      .returning();

    if (lead) {
      await db.insert(activities).values([
        { leadId: lead.id, actorId: null, type: "LEAD_CREATED", metadata: null },
        {
          leadId: lead.id,
          actorId: adminId,
          type: "ASSIGNED",
          metadata: JSON.stringify({ to: memberId }),
        },
      ]);
      await db.insert(notes).values({
        leadId: lead.id,
        authorId: memberId,
        body: "Left a voicemail, will follow up tomorrow.",
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Admin login:  ${process.env.SEED_ADMIN_EMAIL || "admin@leadflow.dev"} / ${process.env.SEED_ADMIN_PASSWORD || "Admin#12345"}`);
  console.log(`Member login: ${process.env.SEED_MEMBER_EMAIL || "member@leadflow.dev"} / ${process.env.SEED_MEMBER_PASSWORD || "Member#12345"}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
