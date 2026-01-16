import { Router } from "express";
import {
  getByEventId,
  register,
  add,
  updateStatus,
  remove,
} from "../controllers/attendeeController.js";

const router = Router({ mergeParams: true });

// Attendee routes
router.get("/", getByEventId);
router.post("/register", register);
router.post("/", add);
router.put("/:userId/status", updateStatus);
router.delete("/:userId", remove);

export default router;
