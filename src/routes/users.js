import { Router } from "express";
import {
  getProfile,
  updateProfile,
  linkCard,
} from "../controllers/userController.js";

const router = Router();

// User routes
router.get("/profile/:uid", getProfile);
router.put("/profile/:uid", updateProfile);
router.post("/card", linkCard);

export default router;
