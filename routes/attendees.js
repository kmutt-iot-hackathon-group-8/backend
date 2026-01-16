import { Router } from "express";
import {
  getByEventId,
  register,
  add,
  updateStatus,
  remove,
} from "../controllers/attendeeController";

const router = Router({ mergeParams: true });

// Attendee routes
router.get("/", getByEventId);
router.post("/register", register);
router.post("/", add);
router.put("/:uid/status", updateStatus);
router.delete("/:uid", remove);

export default router;
