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
// Before the /:userId route below so "lookup" isn't captured as a user id.
router.get("/:id/members/lookup", boardsController.lookupInvitee);
router.post("/:id/members", boardsController.inviteMember);
router.patch("/:id/members/:userId", boardsController.changeMemberRole);
router.delete("/:id/members/:userId", boardsController.removeMember);

export default router;
