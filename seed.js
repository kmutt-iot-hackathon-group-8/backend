const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const saltRounds = 10;

  // Clear existing data
  await prisma.history.deleteMany();
  await prisma.attendee.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // Reset sequence to start from 31 for the owner
  await prisma.$executeRaw`ALTER SEQUENCE users_uid_seq RESTART WITH 31;`;

  // Create owner user with uid 31
  const owner = await prisma.user.create({
    data: {
      fname: "Event",
      lname: "Owner",
      email: "event.owner@example.com",
      cardid: "OWNER001",
      userpassword: await bcrypt.hash("password123", saltRounds),
    },
  });

  // Create additional users
  const user1 = await prisma.user.create({
    data: {
      fname: "John",
      lname: "Doe",
      email: "john.doe@example.com",
      cardid: "CARD001",
      userpassword: await bcrypt.hash("password123", saltRounds),
    },
  });

  const user2 = await prisma.user.create({
    data: {
      fname: "Jane",
      lname: "Smith",
      email: "jane.smith@example.com",
      cardid: "CARD002",
      userpassword: await bcrypt.hash("password123", saltRounds),
    },
  });

  const user3 = await prisma.user.create({
    data: {
      fname: "Alice",
      lname: "Johnson",
      email: "alice.johnson@example.com",
      cardid: "CARD003",
      userpassword: await bcrypt.hash("password123", saltRounds),
    },
  });

  // Create events owned by uid 31
  const event1 = await prisma.event.create({
    data: {
      eventowner: owner.uid,
      eventdetail: "A conference on the latest in technology.",
      eventimg: "https://picsum.photos/300/200?random=1",
      eventstartdate: new Date("2026-02-01"),
      eventenddate: new Date("2026-02-01"),
      eventstarttime: new Date("2026-02-01T09:00:00"),
      eventendtime: new Date("2026-02-01T17:00:00"),
      regisstart: new Date("2026-01-15"),
      regisend: new Date("2026-01-30"),
      contact: "contact@techconf.com",
      eventtitle: "Tech Conference 2026",
      eventlocation: "Convention Center, City",
    },
  });

  const event2 = await prisma.event.create({
    data: {
      eventowner: owner.uid,
      eventdetail: "An art exhibition showcasing local artists.",
      eventimg: "https://picsum.photos/300/200?random=2",
      eventstartdate: new Date("2026-03-15"),
      eventenddate: new Date("2026-03-16"),
      eventstarttime: new Date("2026-03-15T10:00:00"),
      eventendtime: new Date("2026-03-16T18:00:00"),
      regisstart: new Date("2026-02-01"),
      regisend: new Date("2026-03-10"),
      contact: "info@artexpo.com",
      eventtitle: "Spring Art Exhibition",
      eventlocation: "Art Gallery, Downtown",
    },
  });

  // Create attendees
  await prisma.attendee.create({
    data: {
      eventid: event1.eventid,
      uid: user1.uid,
      status: "registered",
    },
  });

  await prisma.attendee.create({
    data: {
      eventid: event1.eventid,
      uid: user2.uid,
      status: "present",
    },
  });

  await prisma.attendee.create({
    data: {
      eventid: event2.eventid,
      uid: user3.uid,
      status: "registered",
    },
  });

  await prisma.attendee.create({
    data: {
      eventid: event2.eventid,
      uid: owner.uid,
      status: "absent",
    },
  });

  // Create history
  await prisma.history.create({
    data: {
      uid: user2.uid,
      eventid: event1.eventid,
      scannedat: new Date("2026-02-01T10:00:00"),
    },
  });

  await prisma.history.create({
    data: {
      uid: user3.uid,
      eventid: event2.eventid,
      scannedat: new Date("2026-03-15T11:00:00"),
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
