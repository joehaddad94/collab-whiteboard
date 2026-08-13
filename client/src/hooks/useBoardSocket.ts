import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ConnectedUser } from "../types";

const SOCKET_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type BoardLeaveReason = "removed" | "board-deleted" | null;

// Owns the live socket connection for one board: join/leave lifecycle,
// connection status, and who else is currently on the board. Drawing/cursor/
// undo-redo state gets added here incrementally as the pieces that consume
// them (Whiteboard, Toolbar) get built, rather than speculatively up front.
export function useBoardSocket(boardId: number) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [leaveReason, setLeaveReason] = useState<BoardLeaveReason>(null);

  useEffect(() => {
    if (!Number.isInteger(boardId)) return;

    const socket = io(SOCKET_BASE, { withCredentials: true });
    socketRef.current = socket;
    setLeaveReason(null);

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-board", { boardId });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("board-joined", (payload: { users: ConnectedUser[] }) => {
      setConnectedUsers(payload.users);
    });

    socket.on("user-joined", (user: ConnectedUser) => {
      setConnectedUsers((prev) => [...prev, user]);
    });

    socket.on("user-left", ({ userId }: { userId: number }) => {
      setConnectedUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    socket.on("removed-from-board", () => setLeaveReason("removed"));
    socket.on("board-deleted", () => setLeaveReason("board-deleted"));

    return () => {
      socket.emit("leave-board", { boardId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId]);

  return { connected, connectedUsers, leaveReason };
}
