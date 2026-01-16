import { sql } from "../db";

const userControllers = {
  // Get user profile
  getProfile: async (req, res) => {
    try {
      const { uid } = req.params;

      const user = await sql`
        SELECT uid, fname, lname, email, cardId FROM users WHERE uid = ${uid}
      `;

      if (user.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user[0]);
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

      const result = await sql`
        UPDATE users 
        SET fname = COALESCE(${fname || null}, fname),
            lname = COALESCE(${lname || null}, lname),
            email = COALESCE(${email || null}, email)
        WHERE uid = ${uid}
        RETURNING uid, fname, lname, email, cardId
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(result[0]);
    } catch (err) {
      console.error("Error updating profile:", err);
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

      const result = await sql`
        UPDATE users 
        SET cardId = ${cardId}
        WHERE uid = ${uid}
        RETURNING uid, fname, lname, email, cardId
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(result[0]);
    } catch (err) {
      console.error("Error linking card:", err);
      res.status(500).json({ error: "Failed to link card" });
    }
  },
};

export default userControllers;
