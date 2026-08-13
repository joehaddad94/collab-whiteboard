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

function isValidPoint(point: unknown): point is { x: number; y: number } {
  return (
    typeof point === "object" &&
    point !== null &&
    typeof (point as { x?: unknown }).x === "number" &&
    typeof (point as { y?: unknown }).y === "number"
  );
}

// Registers join/leave/disconnect handling for one connected socket (ADR-017/019),
// plus streamed drawing events, clear, and undo/redo (ADR-007/017). Cursor and
// chat events are wired up in later steps.
export function registerBoardHandlers(io: Server, socket: Socket) {
  const user = socket.data.user as { userId: number; username: string };

  // Shared guard for every drawing-related event below: the socket must have
  // actually joined a board room (and that board must still have a live session)
  // before any stroke/clear event from it is meaningful.
  function activeSession(): { boardId: number; roomName: string; session: NonNullable<ReturnType<typeof getSession>> } | null {
    const boardId = socket.data.currentBoardId as number | undefined;
    if (boardId === undefined) return null;
    const session = getSession(boardId);
    if (!session) return null;
    return { boardId, roomName: String(boardId), session };
  }

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

  // Eraser is just a stroke with tool: "eraser" (ADR-006/017) — no separate events.
  socket.on(
    "stroke-start",
    (payload: {
      strokeId?: unknown;
      tool?: unknown;
      color?: unknown;
      brushSize?: unknown;
      point?: unknown;
    }) => {
      const active = activeSession();
      if (!active) return;

      const { strokeId, tool, color, brushSize, point } = payload ?? {};
      if (
        typeof strokeId !== "string" ||
        (tool !== "pen" && tool !== "eraser") ||
        typeof color !== "string" ||
        typeof brushSize !== "number" ||
        !isValidPoint(point)
      ) {
        return;
      }

      const stroke: Stroke = {
        id: strokeId,
        userId: user.userId,
        tool,
        color,
        brushSize,
        points: [point],
      };
      active.session.inProgressStrokes.set(strokeId, stroke);

      socket.to(active.roomName).emit("stroke-start", stroke);
    },
  );

  socket.on(
    "stroke-point",
    (payload: { strokeId?: unknown; point?: unknown }) => {
      const active = activeSession();
      if (!active) return;

      const { strokeId, point } = payload ?? {};
      if (typeof strokeId !== "string" || !isValidPoint(point)) return;

      const stroke = active.session.inProgressStrokes.get(strokeId);
      // Ignore points for a stroke this socket's user didn't start — prevents
      // one user from appending to another user's in-progress stroke.
      if (!stroke || stroke.userId !== user.userId) return;

      stroke.points.push(point);
      socket.to(active.roomName).emit("stroke-point", { strokeId, point });
    },
  );

  socket.on("stroke-end", (payload: { strokeId?: unknown }) => {
    const active = activeSession();
    if (!active) return;

    const { strokeId } = payload ?? {};
    if (typeof strokeId !== "string") return;

    const stroke = active.session.inProgressStrokes.get(strokeId);
    if (!stroke || stroke.userId !== user.userId) return;

    active.session.inProgressStrokes.delete(strokeId);
    active.session.strokes.push(stroke);

    const undoStack = active.session.undoStack.get(user.userId) ?? [];
    undoStack.push(stroke);
    active.session.undoStack.set(user.userId, undoStack);
    // A new completed stroke invalidates this user's old redo history.
    active.session.redoStack.set(user.userId, []);

    socket.to(active.roomName).emit("stroke-end", { strokeId });
  });

  // Clear is not undoable (ADR-017/007) — resets strokes and every user's
  // undo/redo stacks. Broadcast to the whole room including the sender (unlike
  // drawing events), so there's one authoritative "board is now empty" moment
  // rather than the clearer assuming their own local clear matches the server.
  socket.on("clear-board", () => {
    const active = activeSession();
    if (!active) return;

    active.session.strokes = [];
    active.session.inProgressStrokes.clear();
    active.session.undoStack.clear();
    active.session.redoStack.clear();

    io.to(active.roomName).emit("board-cleared");
  });

  // Per-user undo/redo (ADR-007). Silent no-op on an empty stack — no error
  // event, since "nothing to undo" isn't really a failure. Broadcast to the
  // whole room including the actor (like clear, unlike drawing) because the
  // *specific* stroke affected is determined by the server-held stack, not
  // something the client already knows for certain before asking.
  socket.on("undo", () => {
    const active = activeSession();
    if (!active) return;

    const undoStack = active.session.undoStack.get(user.userId);
    const stroke = undoStack?.pop();
    if (!stroke) return;

    const index = active.session.strokes.findIndex((s) => s.id === stroke.id);
    if (index !== -1) {
      active.session.strokes.splice(index, 1);
    }

    const redoStack = active.session.redoStack.get(user.userId) ?? [];
    redoStack.push(stroke);
    active.session.redoStack.set(user.userId, redoStack);

    io.to(active.roomName).emit("stroke-removed", { strokeId: stroke.id });
  });

  socket.on("redo", () => {
    const active = activeSession();
    if (!active) return;

    const redoStack = active.session.redoStack.get(user.userId);
    const stroke = redoStack?.pop();
    if (!stroke) return;

    active.session.strokes.push(stroke);

    const undoStack = active.session.undoStack.get(user.userId) ?? [];
    undoStack.push(stroke);
    active.session.undoStack.set(user.userId, undoStack);

    io.to(active.roomName).emit("stroke-restored", { stroke });
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
