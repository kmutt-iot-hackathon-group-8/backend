const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });
const cors = require("cors");
app.use(cors());

const PORT = 3000;
require("dotenv").config();

// Determine environment and backend URL
const isProd = process.env.NODE_ENV === "production";
const BASE_URL = isProd
  ? "https://aleshia-unmanipulated-lisabeth.ngrok-free.dev"
  : "http://localhost:5173";

const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

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
    const users =
      await sql`SELECT uid, fname, lname FROM users WHERE cardId = ${cardId}`;

    // SCENARIO 1: Brand New User (Not in database)
    if (users.length === 0) {
      console.log(`New card detected: ${cardId}. Redirecting to register...`);
      const regUrl = `${BASE_URL}/register?cardId=${cardId}&eventId=${eventId}`;
      return res.send(regUrl); // ESP32 will turn this into a QR Code
    }

    const user = users[0];

    // SCENARIO 2: Known User -> Check Event Attendance
    const registration = await sql`
      SELECT status FROM attendees 
      WHERE uid = ${user.uid} AND eventId = ${eventId}
    `;

    // JIT (Just-In-Time) REGISTRATION: User exists but not registered for THIS event
    if (registration.length === 0) {
      console.log(`Auto-registering ${user.fname} for Event ${eventId}`);

      await sql.begin(async (sql) => {
        await sql`
          INSERT INTO attendees (eventId, uid, status)
          VALUES (${eventId}, ${user.uid}, 'present')
        `;
        await sql`
          INSERT INTO history (uid, eventId) VALUES (${user.uid}, ${eventId})
        `;
      });

      io.emit("announcement", `Welcome, ${user.fname}! (Auto-Registered)`);
      return res.send(`WELCOME_${user.fname.toUpperCase()}`);
    }

    // SCENARIO 3: User already checked in
    if (registration[0].status === "present") {
      return res.send(`ALREADY_IN_${user.fname.toUpperCase()}`);
    }

    // SCENARIO 4: Registered but absent -> Mark as Present
    await sql.begin(async (sql) => {
      await sql`
        UPDATE attendees SET status = 'present' 
        WHERE uid = ${user.uid} AND eventId = ${eventId}
      `;
      await sql`
        INSERT INTO history (uid, eventId) VALUES (${user.uid}, ${eventId})
      `;
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
    const result = await sql.begin(async (sql) => {
      // 1. Check if the Email already exists (Card check handled by Scan endpoint usually, but good for safety)
      const existing =
        await sql`SELECT uid FROM users WHERE email = ${email} LIMIT 1`;
      if (existing.length > 0) throw new Error("EMAIL_EXISTS");

      // 2. Insert new user
      const userResult = await sql`
        INSERT INTO users (fname, lname, email, cardid, userpassword)
        VALUES (${firstName}, ${lastName}, ${email}, ${cardId}, ${password})
        RETURNING uid
      `;

      const newUid = userResult[0].uid;

      // 3. Immediately register them for the event they scanned for
      if (eventId) {
        await sql`
          INSERT INTO attendees (eventId, uid, status)
          VALUES (${eventId}, ${newUid}, 'present')
        `;
        // Log the first-time entry
        await sql`
          INSERT INTO history (uid, eventId) VALUES (${newUid}, ${eventId})
        `;
      }
      return { uid: newUid };
    });

    console.log(
      `Registered & Checked-in: ${firstName} ${lastName} (${cardId})`
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

// Home Page
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
