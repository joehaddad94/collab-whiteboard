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

function parseBoardId(raw: string): number | null {
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
  const boardId = parseBoardId(req.params.id);
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
      "SELECT id, name, owner_id, data, created_at, updated_at FROM Board WHERE id = ?",
    )
    .get(boardId) as BoardRow | undefined;
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  res.json({ ...board, data: JSON.parse(board.data), role: membership.role });
});

router.patch("/:id", (req: AuthenticatedRequest, res: Response) => {
  const boardId = parseBoardId(req.params.id);
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
  const boardId = parseBoardId(req.params.id);
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
  const boardId = parseBoardId(req.params.id);
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

export default router;
