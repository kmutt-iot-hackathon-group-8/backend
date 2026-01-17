const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });
const cors = require("cors");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
app.use(cors());

const PORT = 3000;
require("dotenv").config();

// Determine environment and backend URL
const isProd = process.env.NODE_ENV === "production";
const BASE_URL = isProd
  ? "https://iot2026.adorio.space"
  : "http://localhost:5173";

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

  try {
    // DB CHECK: Find user by the actual scanned cardId
    const users =
      await sql`SELECT "uid", "fname", "lname" FROM users WHERE "cardId" = ${cardId}`;

    // SCENARIO 1: Brand New User (Not in database)
    if (users.length === 0) {
      console.log(`New card detected: ${cardId}. Redirecting to register...`);
      const regUrl = `${BASE_URL}/register?cardId=${cardId}&eventId=${eventId}`;
      return res.send(regUrl); // ESP32 will turn this into a QR Code
    }

    const user = users[0];

    // SCENARIO 2: Known User -> Check Event Attendance
    const registration = await sql`
      SELECT "status" FROM attendees 
      WHERE "uid" = ${user.uid} AND "eventId" = ${eventId}
    `;

    // JIT (Just-In-Time) REGISTRATION: User exists but not registered for THIS event
    if (registration.length === 0) {
      console.log(`Auto-registering ${user.fname} for Event ${eventId}`);

      await sql`
          INSERT INTO attendees ("eventId", "uid", "status")
          VALUES (${eventId}, ${user.uid}, 'present')
        `;
      await sql`
          INSERT INTO history ("uid", "eventId") VALUES (${user.uid}, ${eventId})
        `;

      io.emit("announcement", `Welcome, ${user.fname}! (Auto-Registered)`);
      return res.send(`WELCOME_${user.fname.toUpperCase()}`);
    }

    // SCENARIO 3: User already checked in
    if (registration[0].status === "present") {
      return res.send(`ALREADY_IN_${user.fname.toUpperCase()}`);
    }

    // SCENARIO 4: Registered but absent -> Mark as Present
    await sql`
        UPDATE attendees SET "status" = 'present' 
        WHERE "uid" = ${user.uid} AND "eventId" = ${eventId}
      `;
    await sql`
        INSERT INTO history ("uid", "eventId") VALUES (${user.uid}, ${eventId})
      `;

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
    const existing =
      await sql`SELECT "uid" FROM users WHERE "email" = ${email} LIMIT 1`;
    if (existing.length > 0) throw new Error("EMAIL_EXISTS");

    // 2. Insert new user
    const userResult = await sql`
        INSERT INTO users ("fname", "lname", "email", "cardId", "userPassword")
        VALUES (${firstName}, ${lastName}, ${email}, ${cardId}, ${password})
        RETURNING "uid"
      `;

    const newUid = userResult[0].uid;

    // 3. Immediately register them for the event they scanned for
    if (eventId) {
      await sql`
          INSERT INTO attendees ("eventId", "uid", "status")
          VALUES (${eventId}, ${newUid}, 'present')
        `;
      // Log the first-time entry
      await sql`
          INSERT INTO history ("uid", "eventId") VALUES (${newUid}, ${eventId})
        `;
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
    const events = await sql`
      SELECT 
        e."eventId",
        e."eventDetail" as title,
        e."eventIMG" as image,
        e."eventStartDate" as startDate,
        e."eventEndDate" as endDate,
        e."eventStartTime" as startTime,
        e."eventEndTime" as endTime,
        e."regisStart" as regisStart,
        e."regisEnd" as regisEnd,
        e."contact",
        e."regisURL",
        u."fname" || ' ' || u."lname" as organizer,
        COUNT(a."uid") as attendeeCount
      FROM events e
      LEFT JOIN users u ON e."eventOwner" = u."uid"
      LEFT JOIN attendees a ON e."eventId" = a."eventId"
      GROUP BY e."eventId", u."fname", u."lname"
      ORDER BY e."eventStartDate" ASC
    `;
    res.json(events);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Get single event details
app.get("/api/v1/events/:eventId", async (req, res) => {
  const { eventId } = req.params;
  try {
    const events = await sql`
      SELECT 
        e."eventId",
        e."eventDetail" as title,
        e."eventIMG" as image,
        e."eventStartDate" as startDate,
        e."eventEndDate" as endDate,
        e."eventStartTime" as startTime,
        e."eventEndTime" as endTime,
        e."regisStart" as regisStart,
        e."regisEnd" as regisEnd,
        e."contact",
        e."regisURL",
        u."fname" || ' ' || u."lname" as organizer
      FROM events e
      LEFT JOIN users u ON e."eventOwner" = u."uid"
      WHERE e."eventId" = ${eventId}
    `;
    if (events.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(events[0]);
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// Get attendees for an event
app.get("/api/v1/events/:eventId/attendees", async (req, res) => {
  const { eventId } = req.params;
  try {
    const attendees = await sql`
      SELECT 
        u."uid",
        u."fname",
        u."lname",
        u."email",
        a."status",
        h."scanned_at"
      FROM attendees a
      JOIN users u ON a."uid" = u."uid"
      LEFT JOIN history h ON h."uid" = u."uid" AND h."eventId" = a."eventId"
      WHERE a."eventId" = ${eventId}
      ORDER BY u."fname", u."lname"
    `;
    res.json(attendees);
  } catch (err) {
    console.error("Error fetching attendees:", err);
    res.status(500).json({ error: "Failed to fetch attendees" });
  }
});

// Get user profile
app.get("/api/v1/users/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    const users = await sql`
      SELECT "uid", "fname", "lname", "email"
      FROM users
      WHERE "uid" = ${uid}
    `;
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(users[0]);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Get user's attended events
app.get("/api/v1/users/:uid/attended-events", async (req, res) => {
  const { uid } = req.params;
  try {
    const events = await sql`
      SELECT 
        e."eventId",
        e."eventDetail" as title,
        e."eventIMG" as image,
        e."eventStartDate" as startDate,
        e."eventEndDate" as endDate,
        e."eventStartTime" as startTime,
        e."eventEndTime" as endTime,
        a."status",
        h."scanned_at"
      FROM attendees a
      JOIN events e ON a."eventId" = e."eventId"
      LEFT JOIN history h ON h."uid" = a."uid" AND h."eventId" = a."eventId"
      WHERE a."uid" = ${uid} AND a."status" = 'present'
      ORDER BY e."eventStartDate" DESC
    `;
    res.json(events);
  } catch (err) {
    console.error("Error fetching attended events:", err);
    res.status(500).json({ error: "Failed to fetch attended events" });
  }
});

// Get user's created events
app.get("/api/v1/users/:uid/created-events", async (req, res) => {
  const { uid } = req.params;
  try {
    const events = await sql`
      SELECT 
        "eventId",
        "eventDetail" as title,
        "eventIMG" as image,
        "eventStartDate" as startDate,
        "eventEndDate" as endDate,
        "regisStart",
        "regisEnd"
      FROM events
      WHERE "eventOwner" = ${uid}
      ORDER BY "eventStartDate" DESC
    `;
    res.json(events);
  } catch (err) {
    console.error("Error fetching created events:", err);
    res.status(500).json({ error: "Failed to fetch created events" });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const users = await sql`
      SELECT "uid", "fname", "lname", "email"
      FROM users
      WHERE "email" = ${email} AND "userPassword" = ${password}
    `;
    if (users.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }
    res.json({ success: true, user: users[0] });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Signup endpoint
app.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const existing = await sql`
      SELECT "uid" FROM users WHERE "email" = ${email} LIMIT 1
    `;
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }
    const newUser = await sql`
      INSERT INTO users ("fname", "lname", "email", "userPassword")
      VALUES (${firstName}, ${lastName}, ${email}, ${password})
      RETURNING "uid", "fname", "lname", "email"
    `;
    res.status(201).json({ success: true, user: newUser[0] });
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
const cloudinaryRoutes = require('./src/routes/cloudinary.route');
app.use('/api', cloudinaryRoutes);

const eventRoutes = require('./src/routes/event.route');
app.use('/api', eventRoutes);
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
