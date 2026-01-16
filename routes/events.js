import { Router } from "express";
const router = Router();
import {
  getAll,
  getById,
  create,
  update,
  remove,
} from "../controllers/eventController";

// Event routes
router.get("/", getAll);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
