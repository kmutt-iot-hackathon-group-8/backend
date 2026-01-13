const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });

const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// Mock Database
let registeredUsers = [{ cardId: "12:34:56:78", username: "Admin" }];

// --- ESP32 ENDPOINTS ---

// 1. ESP32 calls this when a card is tapped
app.get("/api/v1/scan-card/:cardId", (req, res) => {
  const { cardId } = req.params;

  if (!cardId || cardId.length < 4) {
    return res.status(400).send("INVALID_CARD_ID");
  }

  const user = registeredUsers.find((u) => u.cardId === cardId);

  if (user) {
    console.log(`Attendance: ${user.username}`);
    io.emit("announcement", `Welcome, ${user.username}!`);
    return res.send("STATUS_OK");
  } else {
    console.log(`New card: ${cardId}`);
    // This URL tells the phone which card it is registering
    const regUrl = `https://aleshia-unmanipulated-lisabeth.ngrok-free.dev/register?cardId=${cardId}`;
    return res.send(regUrl);
  }
});

// --- WEB INTERFACE ENDPOINTS ---

// 2. Serve the registration page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

// 3. Form Submission
app.post("/api/v1/register-user", (req, res) => {
  const { username, email, password, cardId } = req.body;

  if (!cardId) return res.status(400).send("Missing Card ID");

  // Save user
  registeredUsers.push({ cardId, username, email });
  console.log(`Registered: ${username} (${cardId})`);

  // Notify the TFT screen via Socket.io
  io.emit("registration_success", { name: username });

  res.send("<h1>Registration Complete!</h1><p>You can close this tab now.</p>");
});

// Home Page
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
