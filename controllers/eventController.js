import { sql } from "../db";

const eventControllers = {
  // Get all events with optional filtering
  getAll: async (req, res) => {
    try {
      const { date, ownerId } = req.query;
      let query = `
        SELECT e.*, u.fname, u.lname, u.email,
          COUNT(DISTINCT a.uid) as attendeeCount
        FROM events e
        LEFT JOIN users u ON e.eventOwner = u.uid
        LEFT JOIN attendees a ON e.eventId = a.eventId
      `;

      const params = [];

      if (date) {
        query += ` WHERE e.eventStartDate = $${params.length + 1}`;
        params.push(date);
      }

      if (ownerId) {
        query += params.length > 0 ? " AND" : " WHERE";
        query += ` e.eventOwner = $${params.length + 1}`;
        params.push(ownerId);
      }

      query += ` GROUP BY e.eventId, u.uid ORDER BY e.eventStartDate DESC`;

      const events = await sql(query, params);
      res.json(events);
    } catch (err) {
      console.error("Error fetching events:", err);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  },

  // Get single event by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const event = await sql`
        SELECT e.*, u.fname, u.lname, u.email,
          COUNT(DISTINCT a.uid) as attendeeCount
        FROM events e
        LEFT JOIN users u ON e.eventOwner = u.uid
        LEFT JOIN attendees a ON e.eventId = a.eventId
        WHERE e.eventId = ${id}
        GROUP BY e.eventId, u.uid
      `;

      if (event.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json(event[0]);
    } catch (err) {
      console.error("Error fetching event:", err);
      res.status(500).json({ error: "Failed to fetch event" });
    }
  },

  // Create new event
  create: async (req, res) => {
    try {
      const {
        eventOwner,
        eventDetail,
        eventIMG,
        eventStartDate,
        eventEndDate,
        eventStartTime,
        eventEndTime,
        regisStart,
        regisEnd,
        contact,
        regisURL,
      } = req.body;

      if (!eventOwner || !eventStartDate || !eventEndDate || !regisURL) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await sql`
        INSERT INTO events (
          eventOwner, eventDetail, eventIMG, eventStartDate, eventEndDate,
          eventStartTime, eventEndTime, regisStart, regisEnd, contact, regisURL
        ) VALUES (
          ${eventOwner}, ${eventDetail || null}, ${eventIMG || null},
          ${eventStartDate}, ${eventEndDate}, ${eventStartTime || null},
          ${eventEndTime || null}, ${regisStart || null}, ${regisEnd || null},
          ${contact || null}, ${regisURL}
        )
        RETURNING *
      `;

      // Emit Socket.io event (will be done in middleware)
      res.status(201).json(result[0]);
    } catch (err) {
      console.error("Error creating event:", err);
      res.status(500).json({ error: "Failed to create event" });
    }
  },

  // Update event
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach((key) => {
        if (
          [
            "eventDetail",
            "eventIMG",
            "eventStartDate",
            "eventEndDate",
            "eventStartTime",
            "eventEndTime",
            "regisStart",
            "regisEnd",
            "contact",
            "regisURL",
          ].includes(key)
        ) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      values.push(id);

      const query = `
        UPDATE events 
        SET ${fields.join(", ")}
        WHERE eventId = $${paramCount}
        RETURNING *
      `;

      const result = await sql(query, values);
      if (result.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json(result[0]);
    } catch (err) {
      console.error("Error updating event:", err);
      res.status(500).json({ error: "Failed to update event" });
    }
  },

  // Delete event
  remove: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await sql`
        DELETE FROM events WHERE eventId = ${id}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json({ success: true, message: "Event deleted" });
    } catch (err) {
      console.error("Error deleting event:", err);
      res.status(500).json({ error: "Failed to delete event" });
    }
  },
};

export default eventControllers;
