import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function seed() {
  try {
    console.log("🌱 Seeding database...");

    // 1. Create a "System Admin" user to own the events
    // We use ON CONFLICT to avoid errors if you run this script twice
    const admin = await sql`
      INSERT INTO users (fname, lname, email, cardId, userPassword)
      VALUES ('System', 'Admin', 'admin@event.com', 'ADMIN_CARD_001', 'hashed_password_here')
      ON CONFLICT (email) DO UPDATE SET fname = EXCLUDED.fname
      RETURNING uid
    `;

    const adminId = admin[0].uid;
    console.log(`✅ Admin user ready (ID: ${adminId})`);

    // 2. Clear existing events to start fresh (Optional - remove if you want to keep data)
    // await sql`TRUNCATE events CASCADE`;

    // 3. Create Mock Events
    const eventsToCreate = [
      {
        name: "IoT Hackathon 2026",
        start: "2026-01-13 09:00:00",
        end: "2026-01-15 18:00:00",
      },
      {
        name: "NFC Workshop",
        start: "2026-02-01 10:00:00",
        end: "2026-02-01 14:00:00",
      },
    ];

    for (const event of eventsToCreate) {
      await sql`
        INSERT INTO events (eventOwner, eventIMG, eventDate, regisStart, regisEnd)
        VALUES (
          ${adminId}, 
          'https://via.placeholder.com/150', 
          ${event.start.split(" ")[0]}, 
          ${event.start}, 
          ${event.end}
        )
      `;
    }

    console.log("✅ Mock events created successfully!");

    // 4. Show the events so you know which IDs to use
    const allEvents = await sql`SELECT eventId, eventDate FROM events`;
    console.table(allEvents);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    process.exit();
  }
}

const testUser = await sql`
  INSERT INTO users (fname, lname, email, cardId, userPassword)
  VALUES ('John', 'Doe', 'john@example.com', '12:34:56:78', 'password123')
  ON CONFLICT (email) DO UPDATE SET cardId = EXCLUDED.cardId
  RETURNING uid
`;

const userId = testUser[0].uid;

const firstEvent = await sql`SELECT eventId FROM events LIMIT 1`;

if (firstEvent.length > 0) {
  const eventId = firstEvent[0].eventId;

  await sql`
    INSERT INTO attendees (eventId, uid, status)
    VALUES (${eventId}, ${userId}, 'registered')
    ON CONFLICT (eventId, uid) DO NOTHING
  `;

  console.log(
    `✅ Pre-registered John Doe (Card: 12:34:56:78) for Event ID: ${eventId}`
  );
}

seed();
