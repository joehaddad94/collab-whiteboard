import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ConnectedUser, CursorPosition } from "../types";

const SOCKET_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type BoardLeaveReason = "removed" | "board-deleted" | null;

// Owns the live socket connection for one board: join/leave lifecycle,
// connection status, and who else is currently on the board. The socket
// itself is exposed (as state, so consumers re-render when it becomes
// available) so Whiteboard can emit/listen for drawing events directly -
// stroke data is high-frequency and imperative-canvas-driven, so it doesn't
// belong in this hook's React state (see useWhiteboard).
export function useBoardSocket(boardId: number) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [cursors, setCursors] = useState<Record<number, CursorPosition>>({});
  const [leaveReason, setLeaveReason] = useState<BoardLeaveReason>(null);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(boardId)) return;

    const socket = io(SOCKET_BASE, { withCredentials: true });
    setSocket(socket);
    setLeaveReason(null);
    setSocketError(null);

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-board", { boardId });
    });

    socket.on("disconnect", () => setConnected(false));

    // Server uses one generic error event for every rejected action
    // (bad join, malformed payload, etc.) rather than a bespoke event
    // per action type (ADR-017).
    socket.on("error", ({ message }: { message: string }) => {
      setSocketError(message);
    });

    socket.on("board-joined", (payload: { users: ConnectedUser[] }) => {
      setSocketError(null);
      setConnectedUsers(payload.users);
    });

    socket.on("user-joined", (user: ConnectedUser) => {
      setConnectedUsers((prev) => [...prev, user]);
    });

    socket.on("user-left", ({ userId }: { userId: number }) => {
      setConnectedUsers((prev) => prev.filter((u) => u.userId !== userId));
      setCursors((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    socket.on("cursor-update", (cursor: CursorPosition) => {
      setCursors((prev) => ({ ...prev, [cursor.userId]: cursor }));
    });

    socket.on("removed-from-board", () => setLeaveReason("removed"));
    socket.on("board-deleted", () => setLeaveReason("board-deleted"));

    return () => {
      socket.emit("leave-board", { boardId });
      socket.disconnect();
      setSocket(null);
    };
  }, [boardId]);

  function clearSocketError() {
    setSocketError(null);
  }

  return {
    socket,
    connected,
    connectedUsers,
    cursors,
    leaveReason,
    socketError,
    clearSocketError,
  };
}
