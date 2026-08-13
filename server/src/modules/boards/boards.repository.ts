import { db } from "../../db/index.js";
import type { Stroke } from "./boards.types.js";

export type Role = "owner" | "editor";

export interface BoardRow {
  id: number;
  name: string;
  owner_id: number;
  data: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface BoardSummaryRow {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface BoardListRow {
  id: number;
  name: string;
  updated_at: string;
  role: Role;
}

export interface MembershipRow {
  role: Role;
}

export interface MemberRow {
  userId: number;
  username: string;
  role: Role;
}

export function findMembership(
  boardId: number,
  userId: number,
): MembershipRow | undefined {
  return db
    .prepare("SELECT role FROM BoardMember WHERE board_id = ? AND user_id = ?")
    .get(boardId, userId) as MembershipRow | undefined;
}

export function findBoardSummariesForUser(userId: number): BoardListRow[] {
  return db
    .prepare(
      `SELECT Board.id, Board.name, Board.updated_at, BoardMember.role
       FROM Board
       JOIN BoardMember ON BoardMember.board_id = Board.id
       WHERE BoardMember.user_id = ?
       ORDER BY Board.updated_at DESC`,
    )
    .all(userId) as unknown as BoardListRow[];
}

export function insertBoard(
  name: string,
  ownerId: number,
  inviteCode: string,
): number {
  const result = db
    .prepare("INSERT INTO Board (name, owner_id, invite_code) VALUES (?, ?, ?)")
    .run(name, ownerId, inviteCode);
  return Number(result.lastInsertRowid);
}

export function insertMembership(
  boardId: number,
  userId: number,
  role: Role,
): void {
  db.prepare(
    "INSERT INTO BoardMember (board_id, user_id, role) VALUES (?, ?, ?)",
  ).run(boardId, userId, role);
}

export function findBoardSummaryById(
  boardId: number,
): BoardSummaryRow | undefined {
  return db
    .prepare(
      "SELECT id, name, owner_id, created_at, updated_at FROM Board WHERE id = ?",
    )
    .get(boardId) as BoardSummaryRow | undefined;
}

export function findBoardById(boardId: number): BoardRow | undefined {
  return db
    .prepare(
      "SELECT id, name, owner_id, data, invite_code, created_at, updated_at FROM Board WHERE id = ?",
    )
    .get(boardId) as BoardRow | undefined;
}

export function updateBoardName(boardId: number, name: string): void {
  db.prepare(
    "UPDATE Board SET name = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(name, boardId);
}

export function updateBoardData(boardId: number, data: Stroke[]): void {
  db.prepare(
    "UPDATE Board SET data = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(JSON.stringify(data), boardId);
}

export function deleteBoard(boardId: number): void {
  db.prepare("DELETE FROM Board WHERE id = ?").run(boardId);
}

export function findMembersForBoard(boardId: number): MemberRow[] {
  return db
    .prepare(
      `SELECT User.id AS userId, User.username, BoardMember.role
       FROM BoardMember
       JOIN User ON User.id = BoardMember.user_id
       WHERE BoardMember.board_id = ?
       ORDER BY BoardMember.role, User.username`,
    )
    .all(boardId) as unknown as MemberRow[];
}

export function deleteMembership(boardId: number, userId: number): void {
  db.prepare(
    "DELETE FROM BoardMember WHERE board_id = ? AND user_id = ?",
  ).run(boardId, userId);
}

export function updateInviteCode(boardId: number, code: string): void {
  db.prepare("UPDATE Board SET invite_code = ? WHERE id = ?").run(
    code,
    boardId,
  );
}

export function findBoardIdByInviteCode(
  code: string,
): { id: number } | undefined {
  return db
    .prepare("SELECT id FROM Board WHERE invite_code = ?")
    .get(code) as { id: number } | undefined;
}
