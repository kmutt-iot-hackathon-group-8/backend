import "dotenv/config";
import express, { json, urlencoded } from "express";
import { join } from "path";
import cors from "cors";
import { betterAuth } from "better-auth";
import { createServer } from "http";
import socketIo from "socket.io";

// Controllers
import cardControllers from "./controllers/cardController";
// Routes
import eventRoutes from "./routes/events";
import attendeeRoutes from "./routes/attendees";
import userRoutes from "./routes/users";

// ===== APP SETUP =====
const app = express();
const server = createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

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

// ===== BETTER AUTH SETUP =====
const auth = betterAuth({
  database: {
    type: "postgres",
    url: process.env.DATABASE_URL,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  baseURL: `${FRONTEND_URL}/api/auth`,
  trustedOrigins: [FRONTEND_URL],
});

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
