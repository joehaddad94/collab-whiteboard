import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { NotFoundError } from "../../errors.js";
import * as boardsService from "./boards.service.js";

function parseId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw new NotFoundError("Board not found");
  }
  return id;
}

function paramString(raw: string | string[] | undefined): string {
  return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
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
    req.body?.email,
  );
  res.status(alreadyMember ? 200 : 201).json(body);
}

export function removeMember(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  const targetUserId = parseId(req.params.userId);
  boardsService.removeMember(boardId, req.user!.userId, targetUserId);
  res.status(204).send();
}

export function regenerateInviteLink(req: AuthenticatedRequest, res: Response) {
  const boardId = parseId(req.params.id);
  const inviteCode = boardsService.regenerateInviteLink(
    boardId,
    req.user!.userId,
  );
  res.json({ inviteCode });
}

export function join(req: AuthenticatedRequest, res: Response) {
  const { alreadyMember, ...body } = boardsService.joinByInviteCode(
    paramString(req.params.code),
    req.user!.userId,
  );
  res.status(alreadyMember ? 200 : 201).json(body);
}
