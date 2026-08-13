import type { Server, Socket } from "socket.io";
import * as boardsService from "../modules/boards/boards.service.js";
import {
  getSession,
  getOrCreateSession,
  removeSessionIfEmpty,
} from "./boardSessions.js";
import type { Stroke } from "../modules/boards/boards.types.js";

function isValidPoint(point: unknown): point is { x: number; y: number } {
  return (
    typeof point === "object" &&
    point !== null &&
    typeof (point as { x?: unknown }).x === "number" &&
    typeof (point as { y?: unknown }).y === "number"
  );
}

export function registerBoardHandlers(io: Server, socket: Socket) {
  const user = socket.data.user as { userId: number; displayName: string };

  function activeSession(): {
    boardId: number;
    roomName: string;
    session: NonNullable<ReturnType<typeof getSession>>;
  } | null {
    const boardId = socket.data.currentBoardId as number | undefined;
    if (boardId === undefined) return null;
    const session = getSession(boardId);
    if (!session) return null;
    return { boardId, roomName: String(boardId), session };
  }

  socket.on("join-board", (payload: { boardId?: unknown }) => {
    const boardId = Number(payload?.boardId);
    if (
      !Number.isInteger(boardId) ||
      !boardsService.isMember(boardId, user.userId)
    ) {
      socket.emit("error", { message: "Not authorized to join this board" });
      return;
    }

    const previousBoardId = socket.data.currentBoardId as number | undefined;
    if (previousBoardId !== undefined && previousBoardId !== boardId) {
      leaveBoard(socket, previousBoardId);
    }

    const roomName = String(boardId);
    socket.join(roomName);
    socket.data.currentBoardId = boardId;

    const session = getOrCreateSession(boardId, () =>
      boardsService.getBoardStrokes(boardId),
    );
    session.connectedUsers.set(socket.id, {
      userId: user.userId,
      displayName: user.displayName,
    });

    socket.emit("board-joined", {
      strokes: session.strokes,
      users: Array.from(session.connectedUsers.values()),
    });

    socket.to(roomName).emit("user-joined", {
      userId: user.userId,
      displayName: user.displayName,
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
    active.session.redoStack.set(user.userId, []);

    socket.to(active.roomName).emit("stroke-end", { strokeId });
  });

  socket.on("clear-board", () => {
    const active = activeSession();
    if (!active) return;

    active.session.strokes = [];
    active.session.inProgressStrokes.clear();
    active.session.undoStack.clear();
    active.session.redoStack.clear();

    io.to(active.roomName).emit("board-cleared");
  });

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

  socket.on("cursor-move", (payload: { x?: unknown; y?: unknown }) => {
    const active = activeSession();
    if (!active) return;

    const { x, y } = payload ?? {};
    if (typeof x !== "number" || typeof y !== "number") return;

    socket.to(active.roomName).emit("cursor-update", {
      userId: user.userId,
      displayName: user.displayName,
      x,
      y,
    });
  });
}

function leaveBoard(socket: Socket, boardId: number) {
  const roomName = String(boardId);
  const user = socket.data.user as { userId: number; displayName: string };
  const session = getSession(boardId);

  session?.connectedUsers.delete(socket.id);
  socket.leave(roomName);
  if (socket.data.currentBoardId === boardId) {
    socket.data.currentBoardId = undefined;
  }

  socket.to(roomName).emit("user-left", { userId: user.userId });
  removeSessionIfEmpty(boardId);
}
