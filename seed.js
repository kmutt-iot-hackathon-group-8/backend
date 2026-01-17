import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function seed() {
  try {
    console.log("🌱 Seeding database...");

    // 1. Create a "System Admin" user to own the events
    // We use ON CONFLICT to avoid errors if you run this script twice
    const admin = await sql`
      INSERT INTO users ("fname", "lname", "email", "cardid", "userpassword")
      VALUES ('System', 'Admin', 'admin@event.com', 'ADMIN_CARD_001', 'admin123')
      ON CONFLICT ("email") DO UPDATE SET fname = EXCLUDED.fname
      RETURNING uid
    `;

    const adminId = admin[0].uid;
    console.log(`✅ Admin user ready (ID: ${adminId})`);

    // 2. Clear existing data to start fresh
    await sql`TRUNCATE events, attendees, history RESTART IDENTITY CASCADE`;

    // 3. Create Mock Events
    const eventsToCreate = [
      {
        name: "IoT Hackathon 2026",
        start: "2026-02-13 09:00:00",
        end: "2026-02-15 18:00:00",
      },
      {
        name: "NFC Workshop",
        start: "2026-03-01 10:00:00",
        end: "2026-03-01 14:00:00",
      },
      {
        name: "AI Conference 2026",
        start: "2026-04-10 08:00:00",
        end: "2026-04-12 17:00:00",
      },
    ];

    for (const event of eventsToCreate) {
      await sql`
    INSERT INTO events (
      eventowner, eventtitle, eventdetail, eventimg, 
      eventstartdate, eventenddate, eventstarttime, eventendtime, 
      regisstart, regisend, contact
    )
    VALUES (
      ${adminId}, 
      ${event.name},
      ${`This is a detailed description for ${event.name}`},
      'https://via.placeholder.com/150', 
      ${event.start.split(" ")[0]}::date, 
      ${event.end.split(" ")[0]}::date, 
      ${event.start.split(" ")[1]}::time, 
      ${event.end.split(" ")[1]}::time, 
      ${event.start.split(" ")[0]}::date, 
      ${event.end.split(" ")[0]}::date, 
      '${process.env.FRONTEND_URL || 'http://localhost:5173'}/register'
    )
  `;
    }

    console.log("✅ Mock events created successfully!");

    // 4. Create test user
    const testUser = await sql`
      INSERT INTO users ("fname", "lname", "email", "cardid", "userpassword")
      VALUES ('John', 'Doe', 'john@example.com', '12:34:56:78', 'password123')
      ON CONFLICT ("email") DO NOTHING
      RETURNING uid
    `;

    if (testUser.length === 0) {
      // User already exists, get the uid
      const existing =
        await sql`SELECT uid FROM users WHERE email = 'john@example.com'`;
      testUser.push(existing[0]);
    }

    const userId = testUser[0].uid;

    // 5. Register test user for first event as present
    const firstEvent = await sql`SELECT eventid FROM events LIMIT 1`;

    if (firstEvent.length > 0) {
      const eventId = firstEvent[0].eventid;

      await sql`
        INSERT INTO attendees ("eventid", "uid", "status")
        VALUES (${eventId}, ${userId}, 'present')
      `;

      await sql`
        INSERT INTO history ("uid", "eventid") VALUES (${userId}, ${eventId})
      `;

      console.log(
        `✅ Pre-registered John Doe (Card: 12:34:56:78) for Event ID: ${eventId}`,
      );
    }

    // 6. Register admin for second event
    const secondEvent = await sql`SELECT eventid FROM events LIMIT 1 OFFSET 1`;

    if (secondEvent.length > 0) {
      const eventId = secondEvent[0].eventid;

      await sql`
        INSERT INTO attendees ("eventid", "uid", "status")
        VALUES (${eventId}, ${adminId}, 'present')
      `;

      await sql`
        INSERT INTO history ("uid", "eventid") VALUES (${adminId}, ${eventId})
      `;

      console.log(`✅ Pre-registered Admin for Event ID: ${eventId}`);
    }

    // 7. Show the events so you know which IDs to use
    const allEvents =
      await sql`SELECT eventid, eventdetail, eventstartdate FROM events`;
    console.table(allEvents);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    process.exit();
  }
}

seed();
