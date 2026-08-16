import * as boardsService from "../modules/boards/boards.service.js";
import { getSession } from "./boardSessions.js";
import { getIo } from "./realtime.js";

// Live strokes live in the board session and only reach the database when
// something writes them. Leaving that entirely to a Save button meant a board
// everyone closed without pressing it lost the work outright - so the server
// now persists its own session, and Save is a "write it now" shortcut rather
// than the only path.
//
// Debounced rather than per-event: strokes land continuously while people
// draw, and a write per stroke would rewrite the whole row constantly for no
// benefit. The max-wait stops a board that never goes quiet from having its
// write pushed back forever by the debounce.
const AUTOSAVE_DEBOUNCE_MS = 2000;
const AUTOSAVE_MAX_WAIT_MS = 15000;

interface PendingSave {
  timer: NodeJS.Timeout;
  // Absolute time the debounce may no longer push the write past.
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
  // Don't hold the process open for a pending write - the HTTP server keeps
  // the loop alive anyway, and on shutdown a lost debounce is preferable to a
  // hang.
  timer.unref();
  pendingSaves.set(boardId, { timer, deadline });
}

export function saveBoardNow(boardId: number): boolean {
  cancelPendingSave(boardId);

  const session = getSession(boardId);
  if (!session) return false;

  try {
    boardsService.persistBoardStrokes(boardId, session.strokes);
  } catch (err) {
    // Stay silent rather than announce a write that didn't happen: clients
    // keep showing unsaved, and the next change re-arms the debounce and
    // tries again.
    console.error(`Autosave failed for board ${boardId}:`, err);
    return false;
  }

  getIo()
    ?.to(String(boardId))
    .emit("board-saved", { boardId, savedAt: new Date().toISOString() });
  return true;
}

// Called when the last person leaves a board, before its session is dropped -
// this is the moment unsaved work would otherwise disappear for good.
export function flushPendingSave(boardId: number): void {
  if (pendingSaves.has(boardId)) saveBoardNow(boardId);
}

// For a board that no longer exists: its row is gone, so there's nothing left
// worth writing.
export function cancelPendingSave(boardId: number): void {
  const pending = pendingSaves.get(boardId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingSaves.delete(boardId);
}
