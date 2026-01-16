import { prisma } from "../lib/db.js";

const attendeeControllers = {
  // Get attendees for event
  getByEventId: async (req, res) => {
    try {
      const { eventId } = req.params;
      const { status } = req.query;

      const where = {
        eventId: parseInt(eventId),
      };

      if (status) {
        where.status = status;
      }

      const attendees = await prisma.attendee.findMany({
        where,
        include: {
          user: {
            select: {
              fname: true,
              lname: true,
              email: true,
              cardId: true,
            },
          },
        },
        orderBy: {
          user: {
            fname: "asc",
          },
        },
      });

      // Flatten structure to match original response
      const flattenedAttendees = attendees.map((a) => ({
        userId: a.userId,
        status: a.status,
        fname: a.user?.fname,
        lname: a.user?.lname,
        email: a.user?.email,
        cardId: a.user?.cardId,
      }));

      res.json(flattenedAttendees);
    } catch (err) {
      console.error("Error fetching attendees:", err);
      res.status(500).json({ error: "Failed to fetch attendees" });
    }
  },

  // Register user for event
  register: async (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }

      const existing = await prisma.attendee.findUnique({
        where: {
          eventId_userId: {
            eventId: parseInt(eventId),
            userId: parseInt(userId),
          },
        },
      });

      if (existing) {
        return res
          .status(409)
          .json({ error: "User already registered for this event" });
      }

      const newAttendee = await prisma.attendee.create({
        data: {
          eventId: parseInt(eventId),
          userId: parseInt(userId),
          status: "registered",
        },
      });

      res.status(201).json(newAttendee);
    } catch (err) {
      console.error("Error registering for event:", err);
      res.status(500).json({ error: "Failed to register for event" });
    }
  },

  // Add attendee (admin)
  add: async (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId, status = "registered" } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }

      const existing = await prisma.attendee.findUnique({
        where: {
          eventId_userId: {
            eventId: parseInt(eventId),
            userId: parseInt(userId),
          },
        },
      });

      if (existing) {
        return res
          .status(409)
          .json({ error: "User already an attendee for this event" });
      }

      const newAttendee = await prisma.attendee.create({
        data: {
          eventId: parseInt(eventId),
          userId: parseInt(userId),
          status,
        },
      });

      res.status(201).json(newAttendee);
    } catch (err) {
      console.error("Error adding attendee:", err);
      res.status(500).json({ error: "Failed to add attendee" });
    }
  },

  // Update attendee status
  updateStatus: async (req, res) => {
    try {
      const { eventId, userId } = req.params;
      const { status } = req.body;

      if (!["absent", "present", "registered"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updatedAttendee = await prisma.attendee.update({
        where: {
          eventId_userId: {
            eventId: parseInt(eventId),
            userId: parseInt(userId),
          },
        },
        data: { status },
      });

      res.json(updatedAttendee);
    } catch (err) {
      console.error("Error updating attendee status:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Attendee record not found" });
      }
      res.status(500).json({ error: "Failed to update attendee status" });
    }
  },

  // Remove attendee
  remove: async (req, res) => {
    try {
      const { eventId, userId } = req.params;

      await prisma.attendee.delete({
        where: {
          eventId_userId: {
            eventId: parseInt(eventId),
            userId: parseInt(userId),
          },
        },
      });

      res.json({ success: true, message: "Attendee removed" });
    } catch (err) {
      console.error("Error removing attendee:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Attendee record not found" });
      }
      res.status(500).json({ error: "Failed to remove attendee" });
    }
  },
};

export default attendeeControllers;
export const { getByEventId, register, add, updateStatus, remove } =
  attendeeControllers;
