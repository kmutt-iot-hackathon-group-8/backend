import "dotenv/config";
import express, { json, urlencoded } from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Controllers
import cardControllers from "./controllers/cardController.js";

// Routes
import eventRoutes from "./routes/events.js";
import attendeeRoutes from "./routes/attendees.js";
import userRoutes from "./routes/users.js";
import { auth } from "./auth.js";

// ===== APP SETUP =====
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// Environment
const isProd = process.env.NODE_ENV === "production";
const FRONTEND_URL = isProd
  ? process.env.FRONTEND_URL
  : "http://localhost:5173";

// ===== MIDDLEWARE =====
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

// ===== ROUTES =====

// Auth routes
app.use("/api/auth", auth.handler);

// API v1 routes
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/attendees", attendeeRoutes);

// Event attendee subroutes
app.use("/api/v1/events/:eventId/attendees", attendeeRoutes);

// Card scanning
app.get("/api/v1/scan-card/:cardId", (req, res) => {
  cardControllers.scanCard(req, res, io);
});

// Card registration
app.post("/api/v1/register-user", (req, res) => {
  cardControllers.registerCard(req, res, io);
});

// Home page
app.get("/", (_, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

// ===== SOCKET.IO EVENTS =====
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ===== SERVER START =====
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${isProd ? "PRODUCTION" : "DEVELOPMENT"}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
});
