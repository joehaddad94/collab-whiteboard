import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as boardsController from "./boards.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", boardsController.list);
router.post("/", boardsController.create);

router.get("/:id", boardsController.get);
router.patch("/:id", boardsController.rename);
router.delete("/:id", boardsController.remove);
router.put("/:id/data", boardsController.saveData);

router.get("/:id/members", boardsController.listMembers);
router.post("/:id/members", boardsController.inviteMember);
router.delete("/:id/members/:userId", boardsController.removeMember);

router.post(
  "/:id/invite-link/regenerate",
  boardsController.regenerateInviteLink,
);

router.post("/join/:code", boardsController.join);

export default router;
