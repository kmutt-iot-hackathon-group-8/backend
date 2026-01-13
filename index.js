const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });

const PORT = 3000;
require("dotenv").config();

// Determine environment and backend URL
const isProd = process.env.NODE_ENV === "production";
const BASE_URL = isProd
  ? "https://backend-h6j3.onrender.com"
  : "http://localhost:3000";

const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock Database
let registeredUsers = [{ cardId: "12:34:16:78", username: "Admin" }];
const tempCard = "12:34:16:78";
// --- ESP32 ENDPOINTS ---

// 1. ESP32 calls this when a card is tapped
app.get("/api/v1/scan-card/:cardId", async (req, res) => {
  const { cardId } = req.params;

  if (!cardId || cardId.length < 4) {
    return res.status(400).send("INVALID_CARD_ID");
  }

  try {
    // DB CHECK: Find user by card_id
    const users =
      await sql`SELECT fname, lname FROM users WHERE cardId = ${tempCard}`;

    if (users.length > 0) {
      user = users[0];
      console.log(`Attendance: ${user.fname} ${user.lname}`);
      io.emit("announcement", `Welcome, ${user.fname}!`);
      return res.send("STATUS_OK");
    } else {
      console.log(`New card detected: ${tempCard}`);
      // Point to your frontend registration URL
      const regUrl = `${BASE_URL}/register?cardId=${tempCard}`;
      return res.send(regUrl);
    }
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).send("SERVER_ERROR");
  }
});

// --- WEB INTERFACE ENDPOINTS ---

// 2. Serve the registration page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

// 3. Form Submission
app.post("/api/v1/register-user", async (req, res) => {
  const { fname, lname, email, cardId, userPassword } = req.body;

  if (!cardId) return res.status(400).send("Missing Card ID");

  try {
    // DB INSERT: Save new user
    await sql`
      INSERT INTO users (fname, lname, email, cardId, userPassword)
      VALUES (${fname}, ${lname}, ${email}, ${tempCard}, ${userPassword})
      -- ON CONFLICT (cardId) DO NOTHING
    `;

    console.log(`Registered in DB: ${fname} ${lname} (${tempCard})`);
    io.emit("registration_success", { name: fname });

    res.send(
      "<h1>Registration Complete!</h1><p>You can close this tab now.</p>"
    );
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).send("Error saving to database");
  }
});

// Home Page
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
