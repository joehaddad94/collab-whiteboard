import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { CursorPosition } from "../../types";

// Owns cursor state itself rather than it living in useBoardSocket, so a
// cursor moving only re-renders this (CursorOverlay), not the whole
// BoardPage tree - cursor-update is by far the highest-frequency event any
// client receives (throttled to ~25/sec per other user), so where this
// state lives matters a lot more than it would for e.g. presence.
export function useCursorOverlay(socket: Socket | null) {
  const [cursors, setCursors] = useState<Record<number, CursorPosition>>({});

  useEffect(() => {
    if (!socket) return;

    function handleCursorUpdate(cursor: CursorPosition) {
      setCursors((prev) => ({ ...prev, [cursor.userId]: cursor }));
    }

    function handleUserLeft({ userId }: { userId: number }) {
      setCursors((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }

    socket.on("cursor-update", handleCursorUpdate);
    socket.on("user-left", handleUserLeft);

    return () => {
      socket.off("cursor-update", handleCursorUpdate);
      socket.off("user-left", handleUserLeft);
      setCursors({});
    };
  }, [socket]);

  return cursors;
}
