import * as boardsService from "../modules/boards/boards.service.js";
import { getSession } from "./boardSessions.js";
import { getIo } from "./realtime.js";

const AUTOSAVE_DEBOUNCE_MS = 2000;
const AUTOSAVE_MAX_WAIT_MS = 15000;

interface PendingSave {
  timer: NodeJS.Timeout;
  deadline: number;
}

const pendingSaves = new Map<number, PendingSave>();

export function markBoardDirty(boardId: number): void {
  const now = Date.now();
  const existing = pendingSaves.get(boardId);
  if (existing) clearTimeout(existing.timer);

  const deadline = existing?.deadline ?? now + AUTOSAVE_MAX_WAIT_MS;
  const delay = Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, deadline - now));

  const timer = setTimeout(() => saveBoardNow(boardId), delay);
  timer.unref();
  pendingSaves.set(boardId, { timer, deadline });
}

function saveBoardNow(boardId: number): boolean {
  cancelPendingSave(boardId);

  const session = getSession(boardId);
  if (!session) return false;

  try {
    boardsService.persistBoardStrokes(boardId, session.strokes);
  } catch (err) {
    console.error(`Autosave failed for board ${boardId}:`, err);
    return false;
  }

  getIo()
    ?.to(String(boardId))
    .emit("board-saved", { boardId, savedAt: new Date().toISOString() });
  return true;
}

export function flushPendingSave(boardId: number): void {
  if (pendingSaves.has(boardId)) saveBoardNow(boardId);
}

export function cancelPendingSave(boardId: number): void {
  const pending = pendingSaves.get(boardId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingSaves.delete(boardId);
}
