import { sql } from "../db";

const attendeeControllers = {
  // Get attendees for event
  getByEventId: async (req, res) => {
    try {
      const { eventId } = req.params;
      const { status } = req.query;

      let query = `
        SELECT a.uid, a.status, u.fname, u.lname, u.email, u.cardId
        FROM attendees a
        JOIN users u ON a.uid = u.uid
        WHERE a.eventId = ${eventId}
      `;

      if (status) {
        query += ` AND a.status = '${status}'`;
      }

      query += ` ORDER BY u.fname ASC`;

      const attendees = await sql(query);
      res.json(attendees);
    } catch (err) {
      console.error("Error fetching attendees:", err);
      res.status(500).json({ error: "Failed to fetch attendees" });
    }
  },

  // Register user for event
  register: async (req, res) => {
    try {
      const { eventId } = req.params;
      const { uid } = req.body;

      if (!uid) {
        return res.status(400).json({ error: "Missing uid" });
      }

      const existing = await sql`
        SELECT * FROM attendees WHERE eventId = ${eventId} AND uid = ${uid}
      `;

      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "User already registered for this event" });
      }

      const result = await sql`
        INSERT INTO attendees (eventId, uid, status)
        VALUES (${eventId}, ${uid}, 'registered')
        RETURNING *
      `;

      res.status(201).json(result[0]);
    } catch (err) {
      console.error("Error registering for event:", err);
      res.status(500).json({ error: "Failed to register for event" });
    }
  },

  // Add attendee (admin)
  add: async (req, res) => {
    try {
      const { eventId } = req.params;
      const { uid, status = "registered" } = req.body;

      if (!uid) {
        return res.status(400).json({ error: "Missing uid" });
      }

      const existing = await sql`
        SELECT * FROM attendees WHERE eventId = ${eventId} AND uid = ${uid}
      `;

      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "User already an attendee for this event" });
      }

      const result = await sql`
        INSERT INTO attendees (eventId, uid, status)
        VALUES (${eventId}, ${uid}, ${status})
        RETURNING *
      `;

      res.status(201).json(result[0]);
    } catch (err) {
      console.error("Error adding attendee:", err);
      res.status(500).json({ error: "Failed to add attendee" });
    }
  },

  // Update attendee status
  updateStatus: async (req, res) => {
    try {
      const { eventId, uid } = req.params;
      const { status } = req.body;

      if (!["absent", "present", "registered"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const result = await sql`
        UPDATE attendees 
        SET status = ${status}
        WHERE eventId = ${eventId} AND uid = ${uid}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: "Attendee record not found" });
      }

      res.json(result[0]);
    } catch (err) {
      console.error("Error updating attendee status:", err);
      res.status(500).json({ error: "Failed to update attendee status" });
    }
  },

  // Remove attendee
  remove: async (req, res) => {
    try {
      const { eventId, uid } = req.params;

      const result = await sql`
        DELETE FROM attendees 
        WHERE eventId = ${eventId} AND uid = ${uid}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: "Attendee record not found" });
      }

      res.json({ success: true, message: "Attendee removed" });
    } catch (err) {
      console.error("Error removing attendee:", err);
      res.status(500).json({ error: "Failed to remove attendee" });
    }
  },
};

export default attendeeControllers;
