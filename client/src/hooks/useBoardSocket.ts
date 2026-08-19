import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessage, ConnectedUser } from "../types";

const SOCKET_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type BoardLeaveReason = "removed" | "board-deleted" | null;

export function useBoardSocket(boardId: number) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaveReason, setLeaveReason] = useState<BoardLeaveReason>(null);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(boardId)) return;

    const socket = io(SOCKET_BASE, { withCredentials: true, transports: ["websocket"] });
    setSocket(socket);
    setLeaveReason(null);
    setSocketError(null);

    socket.on("connect", () => {
      setConnected(true);
      setHasConnected(true);
      socket.emit("join-board", { boardId });
    });

    socket.on("disconnect", () => setConnected(false));

    function handleOffline() {
      setConnected(false);
      socket.disconnect();
    }
    function handleOnline() {
      socket.connect();
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    socket.on("error", ({ message }: { message: string }) => {
      setSocketError(message);
    });

    socket.on(
      "board-joined",
      (payload: { users: ConnectedUser[]; messages: ChatMessage[] }) => {
        setSocketError(null);
        setConnectedUsers(payload.users);
        setMessages(payload.messages);
      },
    );

    socket.on("chat-message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("user-joined", (user: ConnectedUser) => {
      setConnectedUsers((prev) =>
        prev.some((u) => u.userId === user.userId) ? prev : [...prev, user],
      );
    });

    socket.on("user-left", ({ userId }: { userId: number }) => {
      setConnectedUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    socket.on("board-saved", ({ savedAt }: { savedAt: string }) => {
      setLastSavedAt(savedAt);
    });

    socket.on("removed-from-board", () => setLeaveReason("removed"));
    socket.on("board-deleted", () => setLeaveReason("board-deleted"));

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      socket.emit("leave-board", { boardId });
      socket.disconnect();
      setSocket(null);
    };
  }, [boardId]);

  function clearSocketError() {
    setSocketError(null);
  }

  function sendMessage(text: string) {
    socket?.emit("chat-message", { text });
  }

  return {
    socket,
    connected,
    hasConnected,
    connectedUsers,
    messages,
    sendMessage,
    lastSavedAt,
    leaveReason,
    socketError,
    clearSocketError,
  };
}
