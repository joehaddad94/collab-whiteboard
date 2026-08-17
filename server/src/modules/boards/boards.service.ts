import { ForbiddenError, NotFoundError, ValidationError } from "../../errors.js";
import { findUserByUsername } from "../auth/auth.repository.js";
import * as boardsRepository from "./boards.repository.js";
import type { Role } from "./boards.repository.js";
import { isValidStroke, type Stroke } from "./boards.types.js";

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
  const boardId = boardsRepository.insertBoard(name, userId);
  boardsRepository.insertMembership(boardId, userId, "owner");
  return getBoardForUser(boardId, userId);
}

export function getBoardForUser(boardId: number, userId: number) {
  const membership = requireMembership(boardId, userId);
  const board = boardsRepository.findBoardById(boardId);
  if (!board) {
    throw new NotFoundError("Board not found");
  }

  return {
    ...board,
    data: JSON.parse(board.data) as Stroke[],
    role: membership.role,
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
  return getBoardForUser(boardId, userId);
}

export function deleteBoardForOwner(boardId: number, userId: number) {
  requireOwner(boardId, userId);
  boardsRepository.deleteBoard(boardId);
}

export function saveBoardData(boardId: number, userId: number, data: unknown) {
  requireMembership(boardId, userId);
  if (!Array.isArray(data) || !data.every(isValidStroke)) {
    throw new ValidationError("data must be an array of valid strokes");
  }
  boardsRepository.updateBoardData(boardId, data as Stroke[]);
  return { id: boardId, data };
}

export function persistBoardStrokes(boardId: number, strokes: Stroke[]) {
  boardsRepository.updateBoardData(boardId, strokes);
}

export function listMembers(boardId: number, userId: number) {
  requireMembership(boardId, userId);
  return boardsRepository.findMembersForBoard(boardId);
}

function requireUsername(raw: unknown): string {
  const username = typeof raw === "string" ? raw.trim() : "";
  if (username.length === 0) {
    throw new ValidationError("username is required");
  }
  return username;
}

export function lookupInvitee(
  boardId: number,
  userId: number,
  rawUsername: unknown,
) {
  requireOwner(boardId, userId);
  const username = requireUsername(rawUsername);

  const targetUser = findUserByUsername(username);
  if (!targetUser) {
    return { username, exists: false, alreadyMember: false, isSelf: false };
  }

  return {
    username: targetUser.username,
    exists: true,
    alreadyMember:
      boardsRepository.findMembership(boardId, targetUser.id) !== undefined,
    isSelf: targetUser.id === userId,
  };
}

export function inviteMember(
  boardId: number,
  userId: number,
  rawUsername: unknown,
) {
  requireOwner(boardId, userId);
  const username = requireUsername(rawUsername);

  const targetUser = findUserByUsername(username);
  if (!targetUser) {
    throw new NotFoundError(`No user named "${username}"`);
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
  const membership = requireMembership(boardId, userId);
  if (targetUserId !== userId && membership.role !== "owner") {
    throw new ForbiddenError("Only the board owner can remove other people");
  }

  const board = boardsRepository.findBoardSummaryById(boardId);
  if (board && targetUserId === board.owner_id) {
    throw new ValidationError(
      targetUserId === userId
        ? "You own this board - delete it instead of leaving"
        : "Cannot remove the board owner",
    );
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
