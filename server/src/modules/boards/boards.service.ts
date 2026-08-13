import crypto from "node:crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors.js";
import { findUserByUsername } from "../auth/auth.repository.js";
import * as boardsRepository from "./boards.repository.js";
import type { Role } from "./boards.repository.js";
import type { Stroke } from "./boards.types.js";

function validateName(name: unknown): string {
  if (typeof name !== "string") {
    throw new ValidationError("Board name is required (max 100 characters)");
  }
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    throw new ValidationError("Board name is required (max 100 characters)");
  }
  return trimmed;
}

function generateInviteCode(): string {
  return crypto.randomBytes(16).toString("hex");
}

function requireMembership(boardId: number, userId: number) {
  const membership = boardsRepository.findMembership(boardId, userId);
  if (!membership) {
    throw new NotFoundError("Board not found");
  }
  return membership;
}

function requireOwner(boardId: number, userId: number) {
  const membership = requireMembership(boardId, userId);
  if (membership.role !== "owner") {
    throw new ForbiddenError("Only the board owner can do this");
  }
  return membership;
}

export function isMember(boardId: number, userId: number): boolean {
  return boardsRepository.findMembership(boardId, userId) !== undefined;
}

export function getBoardStrokes(boardId: number): Stroke[] {
  const board = boardsRepository.findBoardById(boardId);
  return board ? (JSON.parse(board.data) as Stroke[]) : [];
}

export function listBoardsForUser(userId: number) {
  return boardsRepository.findBoardSummariesForUser(userId);
}

export function createBoard(userId: number, rawName: unknown) {
  const name = validateName(rawName);
  const inviteCode = generateInviteCode();
  const boardId = boardsRepository.insertBoard(name, userId, inviteCode);
  boardsRepository.insertMembership(boardId, userId, "owner");
  return boardsRepository.findBoardSummaryById(boardId);
}

export function getBoardForUser(boardId: number, userId: number) {
  const membership = requireMembership(boardId, userId);
  const board = boardsRepository.findBoardById(boardId);
  if (!board) {
    throw new NotFoundError("Board not found");
  }

  const { invite_code, ...boardFields } = board;
  return {
    ...boardFields,
    data: JSON.parse(board.data) as Stroke[],
    role: membership.role,
    ...(membership.role === "owner" ? { inviteCode: invite_code } : {}),
  };
}

export function renameBoard(
  boardId: number,
  userId: number,
  rawName: unknown,
) {
  requireOwner(boardId, userId);
  const name = validateName(rawName);
  boardsRepository.updateBoardName(boardId, name);
  return boardsRepository.findBoardSummaryById(boardId);
}

export function deleteBoardForOwner(boardId: number, userId: number) {
  requireOwner(boardId, userId);
  boardsRepository.deleteBoard(boardId);
}

export function saveBoardData(boardId: number, userId: number, data: unknown) {
  requireMembership(boardId, userId);
  if (!Array.isArray(data)) {
    throw new ValidationError("data must be an array of strokes");
  }
  boardsRepository.updateBoardData(boardId, data as Stroke[]);
  return { id: boardId, data };
}

export function listMembers(boardId: number, userId: number) {
  requireMembership(boardId, userId);
  return boardsRepository.findMembersForBoard(boardId);
}

export function inviteMember(
  boardId: number,
  userId: number,
  rawUsername: unknown,
) {
  requireOwner(boardId, userId);

  if (typeof rawUsername !== "string" || rawUsername.length === 0) {
    throw new ValidationError("username is required");
  }

  const targetUser = findUserByUsername(rawUsername);
  if (!targetUser) {
    throw new NotFoundError("User not found");
  }

  if (targetUser.id === userId) {
    throw new ValidationError("You can't invite yourself");
  }

  const existing = boardsRepository.findMembership(boardId, targetUser.id);
  if (existing) {
    return {
      userId: targetUser.id,
      username: targetUser.username,
      role: existing.role,
      alreadyMember: true,
    };
  }

  boardsRepository.insertMembership(boardId, targetUser.id, "editor");
  return {
    userId: targetUser.id,
    username: targetUser.username,
    role: "editor" as Role,
    alreadyMember: false,
  };
}

export function removeMember(
  boardId: number,
  userId: number,
  targetUserId: number,
) {
  requireOwner(boardId, userId);

  const board = boardsRepository.findBoardById(boardId);
  if (board && targetUserId === board.owner_id) {
    throw new ValidationError("Cannot remove the board owner");
  }

  const targetMembership = boardsRepository.findMembership(
    boardId,
    targetUserId,
  );
  if (!targetMembership) {
    throw new NotFoundError("Member not found");
  }

  boardsRepository.deleteMembership(boardId, targetUserId);
}

export function regenerateInviteLink(boardId: number, userId: number) {
  requireOwner(boardId, userId);
  const newCode = generateInviteCode();
  boardsRepository.updateInviteCode(boardId, newCode);
  return newCode;
}

export function joinByInviteCode(code: string, userId: number) {
  const board = boardsRepository.findBoardIdByInviteCode(code);
  if (!board) {
    throw new NotFoundError("Invalid invite code");
  }

  const existing = boardsRepository.findMembership(board.id, userId);
  if (existing) {
    return { boardId: board.id, role: existing.role, alreadyMember: true };
  }

  boardsRepository.insertMembership(board.id, userId, "editor");
  return {
    boardId: board.id,
    role: "editor" as Role,
    alreadyMember: false,
  };
}
