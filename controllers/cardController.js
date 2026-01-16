import { sql } from "../db.js";

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
      const users = await sql`
        SELECT uid, fname, lname FROM users WHERE cardId = ${cardId}
      `;

      // If card not registered, send registration URL
      if (users.length === 0) {
        const regUrl = `${FRONTEND_URL}/register?cardId=${cardId}&eventId=${eventId}`;
        return res.send(regUrl);
      }

      const user = users[0];

      // If no event specified, just welcome them
      if (!eventId) {
        return res.send(`WELCOME_${user.fname.toUpperCase()}`);
      }

      // Check if user is registered for this event
      const registration = await sql`
        SELECT status FROM attendees 
        WHERE uid = ${user.uid} AND eventId = ${eventId}
      `;

      // If not registered, auto-register as present
      if (registration.length === 0) {
        await sql`
          INSERT INTO attendees (eventId, uid, status)
          VALUES (${eventId}, ${user.uid}, 'present')
        `;
        await sql`
          INSERT INTO history (uid, eventId) VALUES (${user.uid}, ${eventId})
        `;

        io.emit("announcement", `Welcome, ${user.fname}! (Auto-Registered)`);
        return res.send(`WELCOME_${user.fname.toUpperCase()}`);
      }

      // If already present, notify
      if (registration[0].status === "present") {
        return res.send(`ALREADY_IN_${user.fname.toUpperCase()}`);
      }

      // Mark as present
      await sql`
        UPDATE attendees SET status = 'present' 
        WHERE uid = ${user.uid} AND eventId = ${eventId}
      `;
      await sql`
        INSERT INTO history (uid, eventId) VALUES (${user.uid}, ${eventId})
      `;

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
      const result = await sql`
        UPDATE users 
        SET cardId = ${cardId}
        WHERE uid = ${uid}
        RETURNING uid, fname, lname, email
      `;

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // If eventId provided, also register for event
      if (eventId) {
        const existing = await sql`
          SELECT * FROM attendees WHERE eventId = ${eventId} AND uid = ${uid}
        `;

        if (existing.length === 0) {
          await sql`
            INSERT INTO attendees (eventId, uid, status)
            VALUES (${eventId}, ${uid}, 'present')
          `;
          await sql`
            INSERT INTO history (uid, eventId) VALUES (${uid}, ${eventId})
          `;
        }
      }

      io.emit("card_registered", { name: result[0].fname });

      res.status(200).json({
        success: true,
        message: "Card registered and checked-in successfully!",
        user: result[0],
      });
    } catch (err) {
      console.error("Error registering card:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

export default cardControllers;
