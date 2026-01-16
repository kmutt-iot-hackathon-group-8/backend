import { prisma } from "../db.js";

const userControllers = {
  // Get user profile
  getProfile: async (req, res) => {
    try {
      const { uid } = req.params;

      const user = await prisma.user.findUnique({
        where: { uid: parseInt(uid) },
        select: {
          uid: true,
          fname: true,
          lname: true,
          email: true,
          cardId: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (err) {
      console.error("Error fetching profile:", err);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  },

  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const { uid } = req.params;
      const { fname, lname, email } = req.body;

      const user = await prisma.user.update({
        where: { uid: parseInt(uid) },
        data: {
          fname: fname || undefined,
          lname: lname || undefined,
          email: email || undefined,
        },
        select: {
          uid: true,
          fname: true,
          lname: true,
          email: true,
          cardId: true,
        },
      });

      res.json(user);
    } catch (err) {
      console.error("Error updating profile:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(500).json({ error: "Failed to update profile" });
    }
  },

  // Link NFC card to user
  linkCard: async (req, res) => {
    try {
      const { uid, cardId } = req.body;

      if (!uid || !cardId) {
        return res.status(400).json({ error: "Missing uid or cardId" });
      }

      const user = await prisma.user.update({
        where: { uid: parseInt(uid) },
        data: { cardId },
        select: {
          uid: true,
          fname: true,
          lname: true,
          email: true,
          cardId: true,
        },
      });

      res.json(user);
    } catch (err) {
      console.error("Error linking card:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(500).json({ error: "Failed to link card" });
    }
  },
};

export default userControllers;
export const { getProfile, updateProfile, linkCard } = userControllers;
