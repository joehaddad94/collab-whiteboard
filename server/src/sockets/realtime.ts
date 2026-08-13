import type { Server } from "socket.io";
import { getSession, removeSessionIfEmpty } from "./boardSessions.js";

let io: Server | undefined;

export function setIo(server: Server) {
  io = server;
}

export function evictUserFromBoard(boardId: number, userId: number) {
  if (!io) return;
  const session = getSession(boardId);
  if (!session) return;

  const roomName = String(boardId);

  for (const [socketId, connectedUser] of session.connectedUsers) {
    if (connectedUser.userId !== userId) continue;

    const socket = io.sockets.sockets.get(socketId);
    session.connectedUsers.delete(socketId);
    socket?.leave(roomName);
    if (socket && socket.data.currentBoardId === boardId) {
      socket.data.currentBoardId = undefined;
    }
    socket?.emit("removed-from-board", { boardId });
  }

  io.to(roomName).emit("user-left", { userId });
  removeSessionIfEmpty(boardId);
}

export function evictAllFromBoard(boardId: number) {
  if (!io) return;
  const session = getSession(boardId);
  if (!session) return;

  const roomName = String(boardId);

  for (const socketId of session.connectedUsers.keys()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.data.currentBoardId === boardId) {
      socket.data.currentBoardId = undefined;
    }
    socket?.leave(roomName);
    socket?.emit("board-deleted", { boardId });
  }

  session.connectedUsers.clear();
  removeSessionIfEmpty(boardId);
}
