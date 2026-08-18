import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessage, ConnectedUser } from "../types";

const SOCKET_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type BoardLeaveReason = "removed" | "board-deleted" | null;

// Owns the socket for one board: join/leave, connection status, and who else
// is here. The socket is exposed as state so Whiteboard can emit and listen
// for drawing events directly - stroke data is high-frequency and goes
// straight to the canvas, so it has no business in React state here. Cursor
// positions live in CursorOverlay for the same reason: a cursor moving
// shouldn't re-render the toolbar, the user list, or the rest of the page.
export function useBoardSocket(boardId: number) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  // Tells a first connect from a reconnect, so the UI can say "Connecting"
  // on load and "Reconnecting" after a drop.
  const [hasConnected, setHasConnected] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaveReason, setLeaveReason] = useState<BoardLeaveReason>(null);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(boardId)) return;

    // Straight to WebSocket, skipping the default polling-then-upgrade
    // handshake. The server supports it, and it saves a round trip on every
    // connect and reconnect.
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

    // Socket.io only notices a dead connection when its heartbeat times out -
    // pingInterval + pingTimeout, measured at 45s with the defaults. The
    // browser knows the moment the network drops, so trust that instead.
    function handleOffline() {
      setConnected(false);
      // Actually close it, don't just flag it. Socket.io reports connected
      // as true until its heartbeat times out, so handleOnline below would
      // read a stale yes and skip the reconnect.
      socket.disconnect();
    }
    function handleOnline() {
      socket.connect();
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // The server uses one generic error event for every rejected action - bad
    // join, malformed payload, and so on - rather than one event per action.
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

    // The server echoes chat back to the sender too, so there's no optimistic
    // local append and nothing to reconcile.
    socket.on("chat-message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    // The server already suppresses user-joined for someone still present on
    // another socket. Deduping here too covers a join and a reconnect
    // crossing on the wire.
    socket.on("user-joined", (user: ConnectedUser) => {
      setConnectedUsers((prev) =>
        prev.some((u) => u.userId === user.userId) ? prev : [...prev, user],
      );
    });

    socket.on("user-left", ({ userId }: { userId: number }) => {
      setConnectedUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    // The server owns persistence and writes on a debounce, so "saved" is
    // something it tells us, not something we infer from a request finishing.
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
