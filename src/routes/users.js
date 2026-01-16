import { Router } from "express";
import {
  getProfile,
  updateProfile,
  linkCard,
} from "../controllers/userController.js";

const router = Router();

// User routes
router.get("/profile/:id", getProfile);
router.put("/profile/:id", updateProfile);
router.post("/card", linkCard);

export default router;
