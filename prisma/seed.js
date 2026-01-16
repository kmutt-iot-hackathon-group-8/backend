import { prisma } from "../src/lib/db.js";

async function seed() {
  try {
    console.log("🌱 Seeding database...");

    // 1. Create a "System Admin" user to own the events
    const admin = await prisma.user.upsert({
      where: { email: "admin@event.com" },
      update: {
        fname: "System",
        lname: "Admin",
        name: "System Admin",
        emailVerified: true,
        // Preserve password if exists, or update if you want to reset
      },
      create: {
        fname: "System",
        lname: "Admin",
        name: "System Admin",
        email: "admin@event.com",
        emailVerified: true,
        cardId: "ADMIN_CARD_001",
        userPassword: "hashed_password_here",
      },
    });

    console.log(`✅ Admin user ready (ID: ${admin.id})`);

    // 2. Create Mock Events
    const eventsToCreate = [
      {
        name: "IoT Hackathon 2026",
        startDate: new Date("2026-01-13"),
        endDate: new Date("2026-01-15"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T18:00:00Z"),
        regStart: new Date("2026-01-13"),
        regEnd: new Date("2026-01-15"),
      },
      {
        name: "NFC Workshop",
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-02-01"),
        startTime: new Date("1970-01-01T10:00:00Z"),
        endTime: new Date("1970-01-01T14:00:00Z"),
        regStart: new Date("2026-02-01"),
        regEnd: new Date("2026-02-01"),
      },
    ];

    for (const event of eventsToCreate) {
      // Check if event exists (simple check by detail/name if unique, otherwise just create)
      // Here we just create them. If you want to avoid duplicates, you'd need a unique key or check first.
      // For seeding, let's just creating if not exists based on some criteria or clean up first?
      // The previous seed didn't clear events, but it appended.
      // Let's assume we want to create them if they don't exist logic is hard without unique constraint on name.
      // I will Create only if not found by name in eventDetail to match previous logic style.

      const existing = await prisma.event.findFirst({
        where: { eventDetail: event.name, eventOwner: admin.id },
      });

      if (!existing) {
        await prisma.event.create({
          data: {
            eventOwner: admin.id,
            eventDetail: event.name,
            eventIMG: "https://via.placeholder.com/150",
            eventStartDate: event.startDate,
            eventEndDate: event.endDate,
            eventStartTime: event.startTime,
            eventEndTime: event.endTime,
            regisStart: event.regStart,
            regisEnd: event.regEnd,
            regisURL: "https://example.com/register",
            contact: "contact@example.com",
          },
        });
      }
    }

    console.log("✅ Mock events created successfully!");

    // 4. Show the events
    const allEvents = await prisma.event.findMany({
      select: { eventId: true, eventStartDate: true, eventDetail: true },
    });
    console.table(allEvents);

    // Create Test User
    const testUser = await prisma.user.upsert({
      where: { email: "john@example.com" },
      update: {
        cardId: "12:34:56:78",
        name: "John Doe",
        emailVerified: true,
      },
      create: {
        fname: "John",
        lname: "Doe",
        name: "John Doe",
        emailVerified: true,
        email: "john@example.com",
        cardId: "12:34:56:78",
        userPassword: "password123",
      },
    });

    // Register Test User to First Event
    if (allEvents.length > 0) {
      const eventId = allEvents[0].eventId;

      // Upsert attendee
      const attendee = await prisma.attendee.findUnique({
        where: {
          eventId_userId: {
            eventId: eventId,
            userId: testUser.id,
          },
        },
      });

      if (!attendee) {
        await prisma.attendee.create({
          data: {
            eventId: eventId,
            userId: testUser.id,
            status: "REGISTERED",
          },
        });
        console.log(
          `✅ Pre-registered John Doe (Card: 12:34:56:78) for Event ID: ${eventId}`
        );
      }
    }
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    await prisma.$disconnect();
    process.exit();
  }
}

seed();
