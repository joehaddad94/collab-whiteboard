import type { Server, Socket } from "socket.io";
import { db } from "../db/index.js";
import {
  getSession,
  getOrCreateSession,
  removeSessionIfEmpty,
  type Stroke,
} from "./boardSessions.js";

interface BoardDataRow {
  data: string;
}

function loadStrokesFromDb(boardId: number): Stroke[] {
  const board = db
    .prepare("SELECT data FROM Board WHERE id = ?")
    .get(boardId) as BoardDataRow | undefined;
  return board ? (JSON.parse(board.data) as Stroke[]) : [];
}

function isMember(boardId: number, userId: number): boolean {
  return (
    db
      .prepare("SELECT 1 FROM BoardMember WHERE board_id = ? AND user_id = ?")
      .get(boardId, userId) !== undefined
  );
}

// Registers join/leave/disconnect handling for one connected socket (ADR-017/019).
// Drawing, cursor, undo/redo, and chat events are wired up in later steps.
export function registerBoardHandlers(_io: Server, socket: Socket) {
  const user = socket.data.user as { userId: number; username: string };

  socket.on("join-board", (payload: { boardId?: unknown }) => {
    const boardId = Number(payload?.boardId);
    if (!Number.isInteger(boardId) || !isMember(boardId, user.userId)) {
      // Same non-leaking posture as GET /api/boards/:id (ADR-016) — a generic
      // rejection, not "board doesn't exist" vs "you're not a member".
      socket.emit("error", { message: "Not authorized to join this board" });
      return;
    }

    const roomName = String(boardId);
    socket.join(roomName);
    socket.data.currentBoardId = boardId;

    const session = getOrCreateSession(boardId, () => loadStrokesFromDb(boardId));
    session.connectedUsers.set(socket.id, {
      userId: user.userId,
      username: user.username,
    });

    // Full resync to the joining client — strokes + presence snapshot (ADR-017).
    socket.emit("board-joined", {
      strokes: session.strokes,
      users: Array.from(session.connectedUsers.values()),
    });

    socket.to(roomName).emit("user-joined", {
      userId: user.userId,
      username: user.username,
    });
  });

  socket.on("leave-board", (payload: { boardId?: unknown }) => {
    const boardId = Number(payload?.boardId);
    if (Number.isInteger(boardId)) {
      leaveBoard(socket, boardId);
    }
  });

  socket.on("disconnect", () => {
    const boardId = socket.data.currentBoardId as number | undefined;
    if (boardId !== undefined) {
      leaveBoard(socket, boardId);
    }
  });
}

function leaveBoard(socket: Socket, boardId: number) {
  const roomName = String(boardId);
  const user = socket.data.user as { userId: number; username: string };
  const session = getSession(boardId);

  session?.connectedUsers.delete(socket.id);
  socket.leave(roomName);
  if (socket.data.currentBoardId === boardId) {
    socket.data.currentBoardId = undefined;
  }

  socket.to(roomName).emit("user-left", { userId: user.userId });
  removeSessionIfEmpty(boardId);
}
