const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
app.use(cors());

const PORT = 3000;
require("dotenv").config();

// Determine environment and backend URL
const isProd = process.env.NODE_ENV === "production";
const BASE_URL = isProd
  ? "https://iot2026.adorio.space"
  : "http://localhost:5173";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock Database
let registeredUsers = [{ cardId: "12:34:16:78", username: "Admin" }];
const tempCard = "12:34:26:78";
// --- ESP32 ENDPOINTS ---

// 1. ESP32 calls this when a card is tapped
app.get("/api/v1/scan-card/:cardId", async (req, res) => {
  const { cardId } = req.params;
  const eventId = req.query.eventId; // maybe should add || "1" for demo purpose

  if (!cardId || cardId.length < 4) {
    return res.status(400).send("INVALID_CARD_ID");
  }

  try {
    // DB CHECK: Find user by the actual scanned cardId
    const users = await prisma.user.findMany({
      where: { cardId },
      select: { uid: true, fname: true, lname: true },
    });

    // SCENARIO 1: Brand New User (Not in database)
    if (users.length === 0) {
      console.log(`New card detected: ${cardId}. Redirecting to register...`);
      const regUrl = `${BASE_URL}/register?cardId=${cardId}&eventId=${eventId}`;
      return res.send(regUrl); // ESP32 will turn this into a QR Code
    }

    const user = users[0];

    // SCENARIO 2: Known User -> Check Event Attendance
    const registration = await prisma.attendee.findMany({
      where: { uid: user.uid, eventId: parseInt(eventId) },
      select: { status: true },
    });

    // JIT (Just-In-Time) REGISTRATION: User exists but not registered for THIS event
    if (registration.length === 0) {
      console.log(`Auto-registering ${user.fname} for Event ${eventId}`);

      await prisma.attendee.create({
        data: { eventId: parseInt(eventId), uid: user.uid, status: "present" },
      });
      await prisma.history.create({
        data: { uid: user.uid, eventId: parseInt(eventId) },
      });

      io.emit("announcement", `Welcome, ${user.fname}! (Auto-Registered)`);
      return res.send(`WELCOME_${user.fname.toUpperCase()}`);
    }

    // SCENARIO 3: User already checked in
    if (registration[0].status === "present") {
      return res.send(`ALREADY_IN_${user.fname.toUpperCase()}`);
    }

    // SCENARIO 4: Registered but absent -> Mark as Present
    await prisma.attendee.updateMany({
      where: { uid: user.uid, eventId: parseInt(eventId) },
      data: { status: "present" },
    });
    await prisma.history.create({
      data: { uid: user.uid, eventId: parseInt(eventId) },
    });

    console.log(`Success: ${user.fname} checked into Event ${eventId}`);
    io.emit("announcement", `Welcome, ${user.fname}!`);
    return res.send(`WELCOME_${user.fname.toUpperCase()}`);
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).send("SERVER_ERROR");
  }
});

// 3. Form Submission
// app.post("/api/v1/register-user", async (req, res) => {
//   const { fname, lname, email, cardId, userPassword } = req.body;

//   if (!cardId) return res.status(400).send("Missing Card ID");

//   try {
//     // DB INSERT: Save new user
//     await sql`
//       INSERT INTO users (fname, lname, email, cardId, userPassword)
//       VALUES (${fname}, ${lname}, ${email}, ${tempCard}, ${userPassword})
//       -- ON CONFLICT (cardId) DO NOTHING
//     `;

//     console.log(`Registered in DB: ${fname} ${lname} (${tempCard})`);
//     io.emit("registration_success", { name: fname });

//     res.send(
//       "<h1>Registration Complete!</h1><p>You can close this tab now.</p>"
//     );
//   } catch (err) {
//     console.error("Registration Error:", err);
//     res.status(500).send("Error saving to database");
//   }
// });

app.post("/api/v1/register-user", async (req, res) => {
  const { firstName, lastName, email, cardId, password, eventId } = req.body;

  if (!cardId || !email) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields." });
  }

  try {
    // Start transaction to ensure user AND attendee record are created together

    // 1. Check if the Email already exists (Card check handled by Scan endpoint usually, but good for safety)
    const existing = await prisma.user.findFirst({
      where: { email },
      select: { uid: true },
    });
    if (existing) throw new Error("EMAIL_EXISTS");

    // 2. Insert new user
    const userResult = await prisma.user.create({
      data: {
        fname: firstName,
        lname: lastName,
        email,
        cardId,
        userPassword: password,
      },
      select: { uid: true },
    });

    const newUid = userResult.uid;

    // 3. Immediately register them for the event they scanned for
    if (eventId) {
      await prisma.attendee.create({
        data: { eventId: parseInt(eventId), uid: newUid, status: "present" },
      });
      // Log the first-time entry
      await prisma.history.create({
        data: { uid: newUid, eventId: parseInt(eventId) },
      });
    }
    // return { uid: newUid };

    console.log(
      `Registered & Checked-in: ${firstName} ${lastName} (${cardId})`,
    );
    io.emit("registration_success", { name: firstName });

    return res.status(201).json({
      success: true,
      message: "Registration and Check-in successful!",
    });
  } catch (err) {
    console.error("DB Error:", err);
    if (err.message === "EMAIL_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "User already registered with this email.",
      });
    }
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// API Endpoints for Frontend

// Get all events
app.get("/api/v1/events", async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      select: {
        eventid: true,
        eventtitle: true,
        eventdetail: true,
        eventimg: true,
        eventstartdate: true,
        eventenddate: true,
        eventstarttime: true,
        eventendtime: true,
        regisstart: true,
        regisend: true,
        contact: true,
        users: { select: { fname: true, lname: true } },
      },
      orderBy: { eventstartdate: "asc" },
    });

    // Get attendee counts
    const attendeeCounts = await prisma.attendee.groupBy({
      by: ["eventId"],
      _count: { uid: true },
    });
    const countMap = new Map(
      attendeeCounts.map((c) => [c.eventId, c._count.uid]),
    );

    const formattedEvents = events.map((event) => ({
      eventId: event.eventid,
      title: event.eventtitle,
      description: event.eventdetail,
      image: event.eventimg,
      startDate: event.eventstartdate,
      endDate: event.eventenddate,
      startTime: event.eventstarttime,
      endTime: event.eventendtime,
      regisStart: event.regisstart,
      regisEnd: event.regisend,
      contact: event.contact,
      organizer: event.users
        ? `${event.users.fname} ${event.users.lname}`
        : "Unknown Organizer",
      attendeeCount: countMap.get(event.eventid) || 0,
    }));

    res.json(formattedEvents);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Get single event details
app.get("/api/v1/events/:eventId", async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await prisma.event.findUnique({
      where: { eventid: parseInt(eventId) },
      select: {
        eventid: true,
        eventtitle: true,
        eventdetail: true,
        eventimg: true,
        eventstartdate: true,
        eventenddate: true,
        eventstarttime: true,
        eventendtime: true,
        regisstart: true,
        regisend: true,
        contact: true,
        users: { select: { fname: true, lname: true } },
      },
    });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get attendee count
    const attendeeCount = await prisma.attendee.count({
      where: { eventId: parseInt(eventId) },
    });

    const formattedEvent = {
      eventId: event.eventid,
      title: event.eventtitle,
      description: event.eventdetail,
      image: event.eventimg,
      startDate: event.eventstartdate,
      endDate: event.eventenddate,
      startTime: event.eventstarttime,
      endTime: event.eventendtime,
      regisStart: event.regisstart,
      regisEnd: event.regisend,
      contact: event.contact,
      organizer: event.users
        ? `${event.users.fname} ${event.users.lname}`
        : "Unknown Organizer",
      attendeeCount: attendeeCount,
    };
    res.json(formattedEvent);
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// Register for an event
app.post("/api/v1/events/:eventId/register", async (req, res) => {
  const { eventId } = req.params;
  const { uid } = req.body;

  if (!uid) {
    return res
      .status(400)
      .json({ success: false, message: "User ID required" });
  }

  try {
    // Check if already registered
    const existing = await prisma.attendee.findFirst({
      where: { uid: parseInt(uid), eventId: parseInt(eventId) },
    });

    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Already registered" });
    }

    // Register with status "registered"
    await prisma.attendee.create({
      data: {
        eventId: parseInt(eventId),
        uid: parseInt(uid),
        status: "registered",
      },
    });

    res.json({ success: true, message: "Registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Check-in for an event
app.post("/api/v1/events/:eventId/checkin", async (req, res) => {
  const { eventId } = req.params;
  const { uid } = req.body;

  if (!uid) {
    return res
      .status(400)
      .json({ success: false, message: "User ID required" });
  }

  try {
    // Check if registered
    const existing = await prisma.attendee.findFirst({
      where: { uid: parseInt(uid), eventId: parseInt(eventId) },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Not registered for this event" });
    }

    // Update status to "present"
    await prisma.attendee.updateMany({
      where: { uid: parseInt(uid), eventId: parseInt(eventId) },
      data: { status: "present" },
    });

    // Log the check-in
    await prisma.history.create({
      data: { uid: parseInt(uid), eventId: parseInt(eventId) },
    });

    res.json({ success: true, message: "Checked in successfully" });
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get attendees for an event
app.get("/api/v1/events/:eventId/attendees", async (req, res) => {
  const { eventId } = req.params;
  try {
    const attendees = await prisma.attendee.findMany({
      where: { eventId: parseInt(eventId) },
      include: {
        user: { select: { uid: true, fname: true, lname: true, email: true } },
      },
      orderBy: { user: { fname: "asc" } },
    });

    const formattedAttendees = attendees.map((attendee) => ({
      uid: attendee.user.uid,
      fname: attendee.user.fname,
      lname: attendee.user.lname,
      email: attendee.user.email,
      status: attendee.status,
      scanned_at: null, // Placeholder since history relation not available
    }));

    res.json(formattedAttendees);
  } catch (err) {
    console.error("Error fetching attendees:", err);
    res.status(500).json({ error: "Failed to fetch attendees" });
  }
});

// Get user profile
app.get("/api/v1/users/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { uid: parseInt(uid) },
      select: { uid: true, fname: true, lname: true, email: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Update user profile
app.put("/api/v1/users/:uid", async (req, res) => {
  const { uid } = req.params;
  const { firstName, lastName, email, password } = req.body;

  try {
    // Check if email is already taken by another user
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, uid: { not: parseInt(uid) } },
        select: { uid: true },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: "Email already in use" });
      }
    }

    const updateData = {};
    if (firstName) updateData.fname = firstName;
    if (lastName) updateData.lname = lastName;
    if (email) updateData.email = email;
    if (password) updateData.userPassword = password;

    const updatedUser = await prisma.user.update({
      where: { uid: parseInt(uid) },
      data: updateData,
      select: { uid: true, fname: true, lname: true, email: true },
    });

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get user's registered events
app.get("/api/v1/users/:uid/registered-events", async (req, res) => {
  const { uid } = req.params;
  try {
    const eventIds = await prisma.attendee
      .findMany({
        where: {
          uid: parseInt(uid),
          status: { in: ["registered", "present"] },
        },
        select: { eventId: true, status: true },
      })
      .then((attendees) =>
        attendees.map((a) => ({ eventId: a.eventId, status: a.status })),
      );

    if (eventIds.length === 0) {
      return res.json([]);
    }

    const events = await prisma.event.findMany({
      where: { eventid: { in: eventIds.map((e) => e.eventId) } },
      select: {
        eventid: true,
        eventtitle: true,
        eventdetail: true,
        eventimg: true,
        eventstartdate: true,
        eventenddate: true,
        eventstarttime: true,
        eventendtime: true,
      },
      orderBy: { eventstartdate: "desc" },
    });

    const formattedEvents = await Promise.all(
      events.map(async (event) => {
        const attendeeInfo = eventIds.find((e) => e.eventId === event.eventid);
        const history = await prisma.history.findFirst({
          where: { uid: parseInt(uid), eventId: event.eventid },
          select: { scanned_at: true },
          orderBy: { scanned_at: "desc" },
        });
        return {
          eventId: event.eventid,
          title: event.eventtitle,
          image: event.eventimg,
          startDate: event.eventstartdate.toISOString().split("T")[0],
          endDate: event.eventenddate.toISOString().split("T")[0],
          startTime: event.eventstarttime
            .toISOString()
            .split("T")[1]
            .split(".")[0],
          endTime: event.eventendtime.toISOString().split("T")[1].split(".")[0],
          status: attendeeInfo ? attendeeInfo.status : "registered",
          scanned_at: history ? history.scanned_at : null,
        };
      }),
    );

    res.json(formattedEvents);
  } catch (err) {
    console.error("Error fetching registered events:", err);
    res.status(500).json({ error: "Failed to fetch registered events" });
  }
});

// Get user's created events
app.get("/api/v1/users/:uid/created-events", async (req, res) => {
  const { uid } = req.params;
  try {
    const events = await prisma.event.findMany({
      where: { eventowner: parseInt(uid) },
      select: {
        eventid: true,
        eventtitle: true,
        eventdetail: true,
        eventimg: true,
        eventstartdate: true,
        eventenddate: true,
        eventstarttime: true,
        eventendtime: true,
        regisstart: true,
        regisend: true,
      },
      orderBy: { eventstartdate: "desc" },
    });

    const formattedEvents = events.map((event) => ({
      eventId: event.eventid,
      title: event.eventtitle,
      image: event.eventimg,
      startDate: event.eventstartdate,
      endDate: event.eventenddate,
      startTime: event.eventstarttime,
      endTime: event.eventendtime,
      regisStart: event.regisstart,
      regisEnd: event.regisend,
    }));

    res.json(formattedEvents);
  } catch (err) {
    console.error("Error fetching created events:", err);
    res.status(500).json({ error: "Failed to fetch created events" });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: { email, userPassword: password },
      select: { uid: true, fname: true, lname: true, email: true },
    });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Signup endpoint
app.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const existing = await prisma.user.findFirst({
      where: { email },
      select: { uid: true },
    });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }
    const newUser = await prisma.user.create({
      data: {
        fname: firstName,
        lname: lastName,
        email,
        userPassword: password,
      },
      select: { uid: true, fname: true, lname: true, email: true },
    });
    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Home Page
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await prisma.$disconnect();
  server.close(() => {
    console.log("Process terminated");
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await prisma.$disconnect();
  server.close(() => {
    console.log("Process terminated");
  });
});
