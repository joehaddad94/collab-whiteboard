import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessage, ConnectedUser } from "../types";

const SOCKET_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type BoardLeaveReason = "removed" | "board-deleted" | null;

// Owns the live socket connection for one board: join/leave lifecycle,
// connection status, and who else is currently on the board. The socket
// itself is exposed (as state, so consumers re-render when it becomes
// available) so Whiteboard can emit/listen for drawing events directly -
// stroke data is high-frequency and imperative-canvas-driven, so it doesn't
// belong in this hook's React state (see useWhiteboard). Cursor positions
// are the same story - CursorOverlay owns that state itself (useCursorOverlay)
// instead of it living here, so a cursor moving doesn't re-render this
// hook's other consumers (Toolbar, UserList, the whole BoardPage tree).
export function useBoardSocket(boardId: number) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  // Distinguishes a first connect from a reconnect, so the UI can say
  // "Connecting" on load and "Reconnecting" after a drop.
  const [hasConnected, setHasConnected] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaveReason, setLeaveReason] = useState<BoardLeaveReason>(null);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(boardId)) return;

    // Skip the default polling-then-upgrade handshake - go straight to
    // WebSocket, since the server obviously supports it. Saves a round trip
    // on every connect/reconnect for an app whose whole point is real-time feel.
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

    // Server uses one generic error event for every rejected action
    // (bad join, malformed payload, etc.) rather than a bespoke event
    // per action type (ADR-017).
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

    // Broadcast to the whole room including the sender (ADR-020) - no
    // optimistic local echo, so there's no duplicate-message reconciliation.
    socket.on("chat-message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    // The server already suppresses user-joined for a user who's still present
    // on another socket; deduping here too keeps presence correct if a join
    // and a reconnect ever cross on the wire.
    socket.on("user-joined", (user: ConnectedUser) => {
      setConnectedUsers((prev) =>
        prev.some((u) => u.userId === user.userId) ? prev : [...prev, user],
      );
    });

    socket.on("user-left", ({ userId }: { userId: number }) => {
      setConnectedUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    // The server owns persistence now and writes the board on a debounce, so
    // "saved" is something it tells us rather than something the client
    // concludes from its own request finishing.
    socket.on("board-saved", ({ savedAt }: { savedAt: string }) => {
      setLastSavedAt(savedAt);
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

  function sendMessage(text: string) {
    socket?.emit("chat-message", { text });
  }

  function requestSave() {
    socket?.emit("save-board");
  }

  return {
    socket,
    connected,
    hasConnected,
    connectedUsers,
    messages,
    sendMessage,
    lastSavedAt,
    requestSave,
    leaveReason,
    socketError,
    clearSocketError,
  };
}
