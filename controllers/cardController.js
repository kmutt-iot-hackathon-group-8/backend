import { prisma } from "../db.js";

const FRONTEND_URL =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL
    : "http://localhost:5173";

const cardControllers = {
  // ESP32 card scan endpoint
  scanCard: async (req, res, io) => {
    const { cardId } = req.params;
    const eventId = req.query.eventId;

    if (!cardId || cardId.length < 4) {
      return res.status(400).send("INVALID_CARD_ID");
    }

    try {
      // Find user by cardId
      const user = await prisma.user.findUnique({
        where: { cardId },
        select: { uid: true, fname: true, lname: true },
      });

      // If card not registered, send registration URL
      if (!user) {
        const regUrl = `${FRONTEND_URL}/register?cardId=${cardId}&eventId=${eventId}`;
        return res.send(regUrl);
      }

      // If no event specified, just welcome them
      if (!eventId) {
        return res.send(`WELCOME_${user.fname.toUpperCase()}`);
      }

      const eId = parseInt(eventId);

      // Check if user is registered for this event
      const registration = await prisma.attendee.findUnique({
        where: {
          eventId_uid: {
            eventId: eId,
            uid: user.uid,
          },
        },
      });

      // If not registered, auto-register as present
      if (!registration) {
        await prisma.attendee.create({
          data: {
            eventId: eId,
            uid: user.uid,
            status: "present",
          },
        });

        await prisma.history.create({
          data: {
            uid: user.uid,
            eventId: eId,
          },
        });

        io.emit("announcement", `Welcome, ${user.fname}! (Auto-Registered)`);
        return res.send(`WELCOME_${user.fname.toUpperCase()}`);
      }

      // If already present, notify
      if (registration.status === "present") {
        return res.send(`ALREADY_IN_${user.fname.toUpperCase()}`);
      }

      // Mark as present
      await prisma.attendee.update({
        where: {
          eventId_uid: {
            eventId: eId,
            uid: user.uid,
          },
        },
        data: { status: "present" },
      });

      await prisma.history.create({
        data: {
          uid: user.uid,
          eventId: eId,
        },
      });

      io.emit("announcement", `Welcome, ${user.fname}!`);
      res.send(`WELCOME_${user.fname.toUpperCase()}`);
    } catch (err) {
      console.error("DB Error:", err);
      res.status(500).send("SERVER_ERROR");
    }
  },

  // Register card to existing OAuth user
  registerCard: async (req, res, io) => {
    const { cardId, eventId, uid } = req.body;

    if (!cardId || !uid) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (cardId, uid)",
      });
    }

    try {
      // Link card to user
      const user = await prisma.user.update({
        where: { uid: parseInt(uid) },
        data: { cardId },
        select: { uid: true, fname: true, lname: true, email: true },
      });

      // If eventId provided, also register for event
      if (eventId) {
        const eId = parseInt(eventId);

        // Upsert could be used, or check then insert.
        // Logic says "if existing.length === 0", so basically create if not exists.
        // We'll use upsert to be safe or just findUnique then create to match logic exactly.

        const existing = await prisma.attendee.findUnique({
          where: {
            eventId_uid: {
              eventId: eId,
              uid: user.uid,
            },
          },
        });

        if (!existing) {
          await prisma.attendee.create({
            data: {
              eventId: eId,
              uid: user.uid,
              status: "present",
            },
          });

          await prisma.history.create({
            data: {
              uid: user.uid,
              eventId: eId,
            },
          });
        }
      }

      io.emit("card_registered", { name: user.fname });

      res.status(200).json({
        success: true,
        message: "Card registered and checked-in successfully!",
        user: user,
      });
    } catch (err) {
      console.error("Error registering card:", err);
      if (err.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

export default cardControllers;
