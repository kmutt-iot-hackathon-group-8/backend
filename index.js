const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : "*", 
    credentials: true 
  } 
});
const cors = require("cors");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Configure CORS to allow frontend
const corsOptions = {
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true, // Allow specific origin in prod, all in dev
  credentials: true
};
app.use(cors(corsOptions));

const PORT = process.env.PORT || 3000;
require("dotenv").config();

// Determine environment and backend URL
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

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
  const eventId = req.query.eventid; // maybe should add || "1" for demo purpose

  if (!cardId || cardId.length < 4) {
    return res.status(400).send("INVALID_CARD_ID");
  }

  if (!eventId) {
    return res.status(400).send("MISSING_EVENT_ID");
  }

  try {
    // DB CHECK: Find user by the actual scanned cardId
    const users = await prisma.user.findMany({
      where: { cardid: cardId },
      select: { uid: true, fname: true, lname: true },
    });

    // SCENARIO 1: Brand New User (Card not registered)
    if (users.length === 0) {
      console.log(
        `New card detected: ${cardId}. Returning registration QR code...`,
      );
      const regUrl = `${BASE_URL}/register?cardId=${cardId}&eventId=${eventId}`;
      return res.send(regUrl); // ESP32 will turn this into a QR Code
    }

    const user = users[0];

    // SCENARIO 2: Known User -> Check if they're in attendee table for this event
    const existingAttendee = await prisma.attendee.findFirst({
      where: { uid: user.uid, eventid: parseInt(eventId) },
      select: { status: true },
    });

    // If not in attendee table, add them with status 'present'
    if (!existingAttendee) {
      console.log(
        `First time check-in: Adding ${user.fname} to attendee table for Event ${eventId}`,
      );

      await prisma.attendee.create({
        data: {
          eventid: parseInt(eventId),
          uid: user.uid,
          status: "present",
        },
      });
    }
    // If already in attendee table but not present, update status to 'present'
    else if (existingAttendee.status !== "present") {
      console.log(
        `Updating status to present for ${user.fname} in Event ${eventId}`,
      );

      await prisma.attendee.updateMany({
        where: { uid: user.uid, eventid: parseInt(eventId) },
        data: { status: "present" },
      });
    }
    // If already present, just acknowledge
    else {
      console.log(`${user.fname} already checked in for Event ${eventId}`);
      return res.send(`ALREADY_CHECKED_IN_${user.fname.toUpperCase()}`);
    }

    // Create history entry for check-in
    await prisma.history.create({
      data: { uid: user.uid, eventid: parseInt(eventId) },
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
        cardid: cardId,
        userpassword: password,
      },
      select: { uid: true },
    });

    const newUid = userResult.uid;

    // 3. Immediately register them for the event they scanned for
    if (eventId) {
      await prisma.attendee.create({
        data: { eventid: parseInt(eventId), uid: newUid, status: "present" },
      });
      // Log the first-time entry
      await prisma.history.create({
        data: { uid: newUid, eventid: parseInt(eventId) },
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
        eventlocation: true,
        users: { select: { fname: true, lname: true } },
      },
      orderBy: { eventstartdate: "asc" },
    });

    // Get attendee counts
    const attendeeCounts = await prisma.attendee.groupBy({
      by: ["eventid"],
      _count: { uid: true },
    });
    const countMap = new Map(
      attendeeCounts.map((c) => [c.eventid, c._count.uid]),
    );

    const formattedEvents = events.map((event) => {
      // Determine event status based on current date
      const now = new Date();

      // Create event end datetime properly
      const eventEndDate = new Date(event.eventenddate);
      // Extract time components from the time field
      const endTimeStr = event.eventendtime
        .toISOString()
        .split("T")[1]
        .split(".")[0]; // HH:MM:SS
      const [endHours, endMinutes, endSeconds] = endTimeStr
        .split(":")
        .map(Number);

      // Set the time on the end date
      eventEndDate.setHours(endHours, endMinutes, endSeconds, 0);

      // Create event start datetime properly
      const eventStartDate = new Date(event.eventstartdate);
      const startTimeStr = event.eventstarttime
        .toISOString()
        .split("T")[1]
        .split(".")[0]; // HH:MM:SS
      const [startHours, startMinutes, startSeconds] = startTimeStr
        .split(":")
        .map(Number);
      eventStartDate.setHours(startHours, startMinutes, startSeconds, 0);

      let eventStatus = "upcoming";
      if (now > eventEndDate) {
        eventStatus = "ended";
      } else if (now >= eventStartDate) {
        eventStatus = "ongoing";
      }

      return {
        eventId: event.eventid, // Note: using eventId here for the update logic below
        eventid: event.eventid,
        title: event.eventtitle,
        description: event.eventdetail,
        image: event.eventimg,
        startDate: event.eventstartdate.toISOString().split("T")[0],
        endDate: event.eventenddate.toISOString().split("T")[0],
        startTime: startTimeStr,
        endTime: endTimeStr,
        regisStart: event.regisstart.toISOString().split("T")[0],
        regisEnd: event.regisend.toISOString().split("T")[0],
        contact: event.contact,
        location: event.eventlocation || "Location TBD",
        attendeeCount: countMap.get(event.eventid) || 0,
        status: eventStatus,
      };
    });

    // Note: Removed automatic marking of registered users as absent
    // This should be handled by a proper end-of-event process, not on every fetch

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
        eventlocation: true,
        users: { select: { fname: true, lname: true } },
      },
    });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get attendee count
    const attendeeCount = await prisma.attendee.count({
      where: { eventid: parseInt(eventId) },
    });

    // Determine event status based on current date
    const now = new Date();
    const eventEndDateTime = new Date(event.eventenddate);
    eventEndDateTime.setHours(
      event.eventendtime.getHours(),
      event.eventendtime.getMinutes(),
    );

    let eventStatus = "upcoming";
    if (now > eventEndDateTime) {
      eventStatus = "ended";
    } else {
      const eventStartDateTime = new Date(event.eventstartdate);
      eventStartDateTime.setHours(
        event.eventstarttime.getHours(),
        event.eventstarttime.getMinutes(),
      );
      if (now >= eventStartDateTime) {
        eventStatus = "ongoing";
      }
    }

    // Note: Removed automatic marking of registered users as absent
    // This should be handled by a proper end-of-event process, not on every fetch

    const formattedEvent = {
      eventid: event.eventid,
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
      location: event.eventlocation || "Location TBD",
      attendeeCount: attendeeCount,
      status: eventStatus,
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
    // Get event details to check dates and ownership
    const event = await prisma.event.findUnique({
      where: { eventid: parseInt(eventId) },
      select: {
        eventenddate: true,
        eventendtime: true,
        regisstart: true,
        regisend: true,
        eventowner: true,
      },
    });

    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    // Check if user is the event owner
    if (parseInt(event.eventowner) === parseInt(uid)) {
      return res.status(403).json({
        success: false,
        message: "Cannot register for your own event",
      });
    }

    const now = new Date();
    const eventEndDateTime = new Date(event.eventenddate);
    eventEndDateTime.setHours(
      event.eventendtime.getHours(),
      event.eventendtime.getMinutes(),
    );

    // Check if event has ended
    if (now > eventEndDateTime) {
      return res
        .status(400)
        .json({ success: false, message: "Event has ended" });
    }

    // Check if registration period has passed
    const regisEndDateTime = new Date(event.regisend);
    regisEndDateTime.setHours(23, 59, 59, 999);
    if (now > regisEndDateTime) {
      return res
        .status(400)
        .json({ success: false, message: "Registration period has ended" });
    }

    // Check if registration has started
    const regisStartDateTime = new Date(event.regisstart);
    if (now < regisStartDateTime) {
      return res
        .status(400)
        .json({ success: false, message: "Registration has not started yet" });
    }

    // Check if already registered
    const existing = await prisma.attendee.findFirst({
      where: { uid: parseInt(uid), eventid: parseInt(eventId) },
    });

    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Already registered" });
    }

    // Register with status "registered"
    await prisma.attendee.create({
      data: {
        eventid: parseInt(eventId),
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
    // Check if user is the event owner
    const event = await prisma.event.findUnique({
      where: { eventid: parseInt(eventId) },
      select: { eventowner: true },
    });

    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    if (parseInt(event.eventowner) === parseInt(uid)) {
      return res
        .status(403)
        .json({ success: false, message: "Cannot check in to your own event" });
    }
    // Check if registered
    const existing = await prisma.attendee.findFirst({
      where: { uid: parseInt(uid), eventid: parseInt(eventId) },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Not registered for this event" });
    }

    // Update status to "present"
    await prisma.attendee.updateMany({
      where: { uid: parseInt(uid), eventid: parseInt(eventId) },
      data: { status: "present" },
    });

    // Log the check-in
    await prisma.history.create({
      data: { uid: parseInt(uid), eventid: parseInt(eventId) },
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
      where: { eventid: parseInt(eventId) },
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
        return res
          .status(409)
          .json({ success: false, message: "Email already in use" });
      }
    }

    const updateData = {};
    if (firstName) updateData.fname = firstName;
    if (lastName) updateData.lname = lastName;
    if (email) updateData.email = email;
    if (password) updateData.userpassword = password;

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
          status: { in: ["registered", "present", "absent"] },
        },
        select: { eventid: true, status: true },
      })
      .then((attendees) =>
        attendees.map((a) => ({ eventid: a.eventid, status: a.status })),
      );

    if (eventIds.length === 0) {
      return res.json([]);
    }

    const events = await prisma.event.findMany({
      where: { eventid: { in: eventIds.map((e) => e.eventid) } },
      select: {
        eventid: true,
        eventtitle: true,
        eventdetail: true,
        eventimg: true,
        eventstartdate: true,
        eventenddate: true,
        eventstarttime: true,
        eventendtime: true,
        eventlocation: true,
      },
      orderBy: { eventstartdate: "desc" },
    });

    const formattedEvents = await Promise.all(
      events.map(async (event) => {
        const attendeeInfo = eventIds.find((e) => e.eventid === event.eventid);
        const history = await prisma.history.findFirst({
          where: { uid: parseInt(uid), eventid: event.eventid },
          select: { scannedat: true },
          orderBy: { scannedat: "desc" },
        });
        const attendeeCount = await prisma.attendee.count({
          where: { eventid: event.eventid },
        });
        return {
          eventid: event.eventid,
          title: event.eventtitle,
          image: event.eventimg,
          startDate: event.eventstartdate.toISOString().split("T")[0],
          endDate: event.eventenddate.toISOString().split("T")[0],
          startTime: event.eventstarttime
            .toISOString()
            .split("T")[1]
            .split(".")[0],
          endTime: event.eventendtime.toISOString().split("T")[1].split(".")[0],
          location: event.eventlocation || "Location TBD",
          status: attendeeInfo ? attendeeInfo.status : "registered",
          scannedat: history ? history.scannedat : null,
          attendeeCount: attendeeCount,
        };
      }),
    );

    res.json(formattedEvents);
  } catch (err) {
    console.error("Error fetching registered events:", err);
    res.status(500).json({ error: "Failed to fetch registered events" });
  }
});

// Get user's attended events
app.get("/api/v1/users/:uid/attended-events", async (req, res) => {
  const { uid } = req.params;
  try {
    const eventIds = await prisma.attendee
      .findMany({
        where: {
          uid: parseInt(uid),
          status: "present",
        },
        select: { eventid: true, status: true },
      })
      .then((attendees) =>
        attendees.map((a) => ({ eventid: a.eventid, status: a.status })),
      );

    if (eventIds.length === 0) {
      return res.json([]);
    }

    const events = await prisma.event.findMany({
      where: { eventid: { in: eventIds.map((e) => e.eventid) } },
      select: {
        eventid: true,
        eventtitle: true,
        eventdetail: true,
        eventimg: true,
        eventstartdate: true,
        eventenddate: true,
        eventstarttime: true,
        eventendtime: true,
        eventlocation: true,
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
        const attendeeCount = await prisma.attendee.count({
          where: { eventId: event.eventid },
        });
        return {
          eventid: event.eventid,
          title: event.eventtitle,
          image: event.eventimg,
          startDate: event.eventstartdate.toISOString().split("T")[0],
          endDate: event.eventenddate.toISOString().split("T")[0],
          startTime: event.eventstarttime
            .toISOString()
            .split("T")[1]
            .split(".")[0],
          endTime: event.eventendtime.toISOString().split("T")[1].split(".")[0],
          location: event.eventlocation || "Location TBD",
          status: attendeeInfo ? attendeeInfo.status : "present",
          scannedat: history ? history.scannedat : null,
          attendeeCount: attendeeCount,
        };
      }),
    );

    res.json(formattedEvents);
  } catch (err) {
    console.error("Error fetching attended events:", err);
    res.status(500).json({ error: "Failed to fetch attended events" });
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
        eventlocation: true,
      },
      orderBy: { eventstartdate: "desc" },
    });

    const formattedEvents = await Promise.all(
      events.map(async (event) => {
        const attendeeCount = await prisma.attendee.count({
          where: { eventId: event.eventid },
        });
        return {
          eventId: event.eventid,
          title: event.eventtitle,
          image: event.eventimg,
          startDate: event.eventstartdate,
          endDate: event.eventenddate,
          startTime: event.eventstarttime,
          endTime: event.eventendtime,
          regisStart: event.regisstart,
          regisEnd: event.regisend,
          location: event.eventlocation || "Location TBD",
          attendeeCount: attendeeCount,
        };
      }),
    );

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
      where: { email, userpassword: password },
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
  const { firstName, lastName, email, password, cardId, eventId } = req.body;
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

    const userData = {
      fname: firstName,
      lname: lastName,
      email,
      userpassword: password,
    };

    // Add cardId if provided (from QR code registration)
    if (cardId) {
      userData.cardid = cardId;
    }

    const newUser = await prisma.user.create({
      data: userData,
      select: { uid: true, fname: true, lname: true, email: true },
    });

    // If eventId is provided (from QR code), register for the event
    if (eventId && cardId) {
      await prisma.attendee.create({
        data: {
          eventId: parseInt(eventId),
          uid: newUser.uid,
          status: "registered",
        },
      });
    }

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

// Use cloudinary routes
const cloudinaryRoutes = require("./src/routes/cloudinary.route");
app.use("/api", cloudinaryRoutes);

const eventRoutes = require("./src/routes/event.route");
app.use("/api", eventRoutes);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
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
