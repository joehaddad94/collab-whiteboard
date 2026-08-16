import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { NotFoundError } from "../../errors.js";
import * as boardsService from "./boards.service.js";
import { evictAllFromBoard, evictUserFromBoard } from "../../sockets/realtime.js";
import { cancelPendingSave } from "../../sockets/boardAutosave.js";

function parseId(
  raw: string | string[] | undefined,
  notFoundMessage = "Board not found",
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw new NotFoundError(notFoundMessage);
  }
  return id;
}

export function list(req: AuthenticatedRequest, res: Response) {
  res.json(boardsService.listBoardsForUser(req.user!.userId));
}

export function create(req: AuthenticatedRequest, res: Response) {
  const board = boardsService.createBoard(req.user!.userId, req.body?.name);
  res.status(201).json(board);
}

export function get(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  res.json(boardsService.getBoardForUser(boardId, req.user!.userId));
}

export function rename(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  const board = boardsService.renameBoard(
    boardId,
    req.user!.userId,
    req.body?.name,
  );
  res.json(board);
}

export function remove(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  boardsService.deleteBoardForOwner(boardId, req.user!.userId);
  // The row is gone, so a queued autosave has nothing left to write to.
  cancelPendingSave(boardId);
  evictAllFromBoard(boardId);
  res.status(204).send();
}

export function saveData(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  const result = boardsService.saveBoardData(
    boardId,
    req.user!.userId,
    req.body?.data,
  );
  res.json(result);
}

export function listMembers(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  res.json(boardsService.listMembers(boardId, req.user!.userId));
}

export function inviteMember(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  const { alreadyMember, ...body } = boardsService.inviteMember(
    boardId,
    req.user!.userId,
    req.body?.username,
  );
  res.status(alreadyMember ? 200 : 201).json(body);
}

export function lookupInvitee(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  const username = Array.isArray(req.query.username)
    ? req.query.username[0]
    : req.query.username;
  res.json(boardsService.lookupInvitee(boardId, req.user!.userId, username));
}

export function changeMemberRole(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  const targetUserId = parseId(req.params.userId, "Member not found");
  const result = boardsService.changeMemberRole(
    boardId,
    req.user!.userId,
    targetUserId,
    req.body?.role,
  );
  res.json(result);
}

export function removeMember(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  const targetUserId = parseId(req.params.userId, "Member not found");
  boardsService.removeMember(boardId, req.user!.userId, targetUserId);
  evictUserFromBoard(boardId, targetUserId);
  res.status(204).send();
}
