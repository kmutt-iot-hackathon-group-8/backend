import { prisma } from "../lib/db.js";

const eventControllers = {
  // Get all events with optional filtering
  getAll: async (req, res) => {
    try {
      const { date, ownerId } = req.query;

      const where = {};

      if (date) {
        where.eventStartDate = new Date(date);
      }

      if (ownerId) {
        where.eventOwner = ownerId;
      }

      const events = await prisma.event.findMany({
        where,
        include: {
          owner: {
            select: {
              fname: true,
              lname: true,
              email: true,
            },
          },
          attendees: {
            select: {
              userId: true,
            },
            distinct: ["userId"],
          },
        },
        orderBy: {
          eventStartDate: "desc",
        },
      });

      // Transform to match original output structure if needed
      // The original query returned `attendeeCount`. Prisma returns an array of attendees.
      // We can map over the results to add attendeeCount.
      const eventsWithCount = events.map((event) => ({
        ...event,
        attendeeCount: event.attendees.length,
        fname: event.owner?.fname,
        lname: event.owner?.lname,
        email: event.owner?.email,
        owner: undefined, // remove nested object to flatten if desired, or keep it. Original was flat.
        attendees: undefined, // remove large array
      }));

      res.json(eventsWithCount);
    } catch (err) {
      console.error("Error fetching events:", err);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  },

  // Get single event by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const event = await prisma.event.findUnique({
        where: { eventId: parseInt(id) },
        include: {
          owner: {
            select: {
              fname: true,
              lname: true,
              email: true,
            },
          },
          attendees: {
            select: {
              userId: true,
            },
            distinct: ["userId"],
          },
        },
      });

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const eventWithCount = {
        ...event,
        attendeeCount: event.attendees.length,
        fname: event.owner?.fname,
        lname: event.owner?.lname,
        email: event.owner?.email,
        owner: undefined,
        attendees: undefined,
      };

      res.json(eventWithCount);
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

      const newEvent = await prisma.event.create({
        data: {
          eventOwner: parseInt(eventOwner),
          eventDetail: eventDetail || null,
          eventIMG: eventIMG || null,
          eventStartDate: new Date(eventStartDate),
          eventEndDate: new Date(eventEndDate),
          eventStartTime: eventStartTime || null,
          eventEndTime: eventEndTime || null,
          regisStart: regisStart ? new Date(regisStart) : null,
          regisEnd: regisEnd ? new Date(regisEnd) : null,
          contact: contact || null,
          regisURL,
        },
      });

      // Emit Socket.io event (will be done in middleware)
      res.status(201).json(newEvent);
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

      // Filter valid fields
      const validFields = [
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
      ];

      const data = {};
      let hasUpdates = false;

      Object.keys(updates).forEach((key) => {
        if (validFields.includes(key)) {
          // specific handling for dates
          if (
            [
              "eventStartDate",
              "eventEndDate",
              "regisStart",
              "regisEnd",
            ].includes(key)
          ) {
            data[key] = updates[key] ? new Date(updates[key]) : null;
          } else {
            data[key] = updates[key];
          }
          hasUpdates = true;
        }
      });

      if (!hasUpdates) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updatedEvent = await prisma.event.update({
        where: { eventId: parseInt(id) },
        data,
      });

      res.json(updatedEvent);
    } catch (err) {
      console.error("Error updating event:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Event not found" });
      }
      res.status(500).json({ error: "Failed to update event" });
    }
  },

  // Delete event
  remove: async (req, res) => {
    try {
      const { id } = req.params;

      await prisma.event.delete({
        where: { eventId: parseInt(id) },
      });

      res.json({ success: true, message: "Event deleted" });
    } catch (err) {
      console.error("Error deleting event:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Event not found" });
      }
      res.status(500).json({ error: "Failed to delete event" });
    }
  },
};

export default eventControllers;
export const { getAll, getById, create, update, remove } = eventControllers;
