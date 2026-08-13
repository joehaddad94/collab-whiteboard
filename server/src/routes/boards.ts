import { Router, type Response } from "express";
import crypto from "node:crypto";
import { db } from "../db/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

interface BoardRow {
  id: number;
  name: string;
  owner_id: number;
  data: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

interface MembershipRow {
  role: "owner" | "editor";
}

function getMembership(
  boardId: number,
  userId: number,
): MembershipRow | undefined {
  return db
    .prepare("SELECT role FROM BoardMember WHERE board_id = ? AND user_id = ?")
    .get(boardId, userId) as MembershipRow | undefined;
}

function generateInviteCode(): string {
  return crypto.randomBytes(16).toString("hex");
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

function validateName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  return trimmed;
}

// List boards where the caller is a member — summaries only, no `data` blob (ADR-016).
router.get("/", (req: AuthenticatedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT Board.id, Board.name, Board.updated_at, BoardMember.role
       FROM Board
       JOIN BoardMember ON BoardMember.board_id = Board.id
       WHERE BoardMember.user_id = ?
       ORDER BY Board.updated_at DESC`,
    )
    .all(req.user!.userId);
  res.json(rows);
});

router.post("/", (req: AuthenticatedRequest, res: Response) => {
  const name = validateName(req.body?.name);
  if (!name) {
    res
      .status(400)
      .json({ error: "Board name is required (max 100 characters)" });
    return;
  }

  const userId = req.user!.userId;
  const inviteCode = generateInviteCode();

  const result = db
    .prepare("INSERT INTO Board (name, owner_id, invite_code) VALUES (?, ?, ?)")
    .run(name, userId, inviteCode);
  const boardId = Number(result.lastInsertRowid);

  db.prepare(
    "INSERT INTO BoardMember (board_id, user_id, role) VALUES (?, ?, 'owner')",
  ).run(boardId, userId);

  const board = db
    .prepare(
      "SELECT id, name, owner_id, created_at, updated_at FROM Board WHERE id = ?",
    )
    .get(boardId);
  res.status(201).json(board);
});

// Non-members get 404, not 403 — don't confirm a board exists (ADR-016).
router.get("/:id", (req: AuthenticatedRequest, res: Response) => {
  const boardId = parseId(req.params.id);
  if (boardId === null) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const membership = getMembership(boardId, req.user!.userId);
  if (!membership) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const board = db
    .prepare(
      "SELECT id, name, owner_id, data, invite_code, created_at, updated_at FROM Board WHERE id = ?",
    )
    .get(boardId) as BoardRow | undefined;
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const { invite_code, ...boardFields } = board;
  res.json({
    ...boardFields,
    data: JSON.parse(board.data),
    role: membership.role,
    // Only the owner can see/manage the invite link (ADR-009).
    ...(membership.role === "owner" ? { inviteCode: invite_code } : {}),
  });
});

router.patch("/:id", (req: AuthenticatedRequest, res: Response) => {
  const boardId = parseId(req.params.id);
  if (boardId === null) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const membership = getMembership(boardId, req.user!.userId);
  if (!membership) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  if (membership.role !== "owner") {
    res.status(403).json({ error: "Only the board owner can do this" });
    return;
  }

  const name = validateName(req.body?.name);
  if (!name) {
    res
      .status(400)
      .json({ error: "Board name is required (max 100 characters)" });
    return;
  }

  db.prepare(
    "UPDATE Board SET name = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(name, boardId);

  const board = db
    .prepare(
      "SELECT id, name, owner_id, created_at, updated_at FROM Board WHERE id = ?",
    )
    .get(boardId);
  res.json(board);
});

router.delete("/:id", (req: AuthenticatedRequest, res: Response) => {
  const boardId = parseId(req.params.id);
  if (boardId === null) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const membership = getMembership(boardId, req.user!.userId);
  if (!membership) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  if (membership.role !== "owner") {
    res.status(403).json({ error: "Only the board owner can do this" });
    return;
  }

  // BoardMember and ChatMessage rows cascade via ON DELETE CASCADE (ADR-016/020).
  db.prepare("DELETE FROM Board WHERE id = ?").run(boardId);
  res.status(204).send();
});

// Explicit save (ADR-016/007) — any member (owner or editor) can save, not just
// the owner, since drawing is collaborative.
router.put("/:id/data", (req: AuthenticatedRequest, res: Response) => {
  const boardId = parseId(req.params.id);
  if (boardId === null) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const membership = getMembership(boardId, req.user!.userId);
  if (!membership) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const { data } = req.body ?? {};
  if (!Array.isArray(data)) {
    res.status(400).json({ error: "data must be an array of strokes" });
    return;
  }

  db.prepare(
    "UPDATE Board SET data = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(JSON.stringify(data), boardId);

  res.json({ id: boardId, data });
});

router.get("/:id/members", (req: AuthenticatedRequest, res: Response) => {
  const boardId = parseId(req.params.id);
  if (boardId === null) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const membership = getMembership(boardId, req.user!.userId);
  if (!membership) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const members = db
    .prepare(
      `SELECT User.id AS userId, User.username, BoardMember.role
       FROM BoardMember
       JOIN User ON User.id = BoardMember.user_id
       WHERE BoardMember.board_id = ?
       ORDER BY BoardMember.role, User.username`,
    )
    .all(boardId);
  res.json(members);
});

// Owner-only, invite by exact username (ADR-009). Validates the target username
// exists (404 if not — unlike login, revealing this is fine here, see ADR-015),
// rejects self-invites, and is idempotent if already a member.
router.post("/:id/members", (req: AuthenticatedRequest, res: Response) => {
  const boardId = parseId(req.params.id);
  if (boardId === null) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const membership = getMembership(boardId, req.user!.userId);
  if (!membership) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  if (membership.role !== "owner") {
    res.status(403).json({ error: "Only the board owner can do this" });
    return;
  }

  const { username } = req.body ?? {};
  if (typeof username !== "string" || username.length === 0) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  const targetUser = db
    .prepare("SELECT id, username FROM User WHERE username = ?")
    .get(username) as { id: number; username: string } | undefined;
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (targetUser.id === req.user!.userId) {
    res.status(400).json({ error: "You can't invite yourself" });
    return;
  }

  const existing = getMembership(boardId, targetUser.id);
  if (existing) {
    res
      .status(200)
      .json({ userId: targetUser.id, username: targetUser.username, role: existing.role });
    return;
  }

  db.prepare(
    "INSERT INTO BoardMember (board_id, user_id, role) VALUES (?, ?, 'editor')",
  ).run(boardId, targetUser.id);

  res
    .status(201)
    .json({ userId: targetUser.id, username: targetUser.username, role: "editor" });
});

router.delete(
  "/:id/members/:userId",
  (req: AuthenticatedRequest, res: Response) => {
    const boardId = parseId(req.params.id);
    const targetUserId = parseId(req.params.userId);
    if (boardId === null || targetUserId === null) {
      res.status(404).json({ error: "Board not found" });
      return;
    }

    const membership = getMembership(boardId, req.user!.userId);
    if (!membership) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    if (membership.role !== "owner") {
      res.status(403).json({ error: "Only the board owner can do this" });
      return;
    }

    const board = db
      .prepare("SELECT owner_id FROM Board WHERE id = ?")
      .get(boardId) as { owner_id: number } | undefined;
    if (board && targetUserId === board.owner_id) {
      res.status(400).json({ error: "Cannot remove the board owner" });
      return;
    }

    const targetMembership = getMembership(boardId, targetUserId);
    if (!targetMembership) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    db.prepare(
      "DELETE FROM BoardMember WHERE board_id = ? AND user_id = ?",
    ).run(boardId, targetUserId);
    res.status(204).send();
  },
);

router.post(
  "/:id/invite-link/regenerate",
  (req: AuthenticatedRequest, res: Response) => {
    const boardId = parseId(req.params.id);
    if (boardId === null) {
      res.status(404).json({ error: "Board not found" });
      return;
    }

    const membership = getMembership(boardId, req.user!.userId);
    if (!membership) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    if (membership.role !== "owner") {
      res.status(403).json({ error: "Only the board owner can do this" });
      return;
    }

    const newCode = generateInviteCode();
    db.prepare("UPDATE Board SET invite_code = ? WHERE id = ?").run(
      newCode,
      boardId,
    );
    res.json({ inviteCode: newCode });
  },
);

// Redeem a shareable link/code (ADR-009) — joins as 'editor', idempotent if
// already a member. 404 on an unknown code, same non-leaking convention as
// board access elsewhere (ADR-016).
router.post("/join/:code", (req: AuthenticatedRequest, res: Response) => {
  const board = db
    .prepare("SELECT id FROM Board WHERE invite_code = ?")
    .get(req.params.code) as { id: number } | undefined;
  if (!board) {
    res.status(404).json({ error: "Invalid invite code" });
    return;
  }

  const userId = req.user!.userId;
  const existing = getMembership(board.id, userId);
  if (existing) {
    res.status(200).json({ boardId: board.id, role: existing.role });
    return;
  }

  db.prepare(
    "INSERT INTO BoardMember (board_id, user_id, role) VALUES (?, ?, 'editor')",
  ).run(board.id, userId);

  res.status(201).json({ boardId: board.id, role: "editor" });
});

export default router;
