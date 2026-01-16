import "dotenv/config";
import express, { json, urlencoded } from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { toNodeHandler } from "better-auth/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Controllers
import cardControllers from "./controllers/cardController.js";

// Routes
import eventRoutes from "./routes/events.js";
import attendeeRoutes from "./routes/attendees.js";
import userRoutes from "./routes/users.js";
import { auth } from "./lib/auth.ts";

// ===== APP SETUP =====
const app = express();
const server = createServer(app);

// Environment
const isProd = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Auth routes
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(json());
app.use(urlencoded({ extended: true }));

// ===== ROUTES =====

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
