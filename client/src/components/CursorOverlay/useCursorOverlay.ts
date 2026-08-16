import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { CursorPosition } from "../../types";
import { getViewTransform, type ViewTransform } from "../../lib/worldView";

// Owns cursor state itself rather than it living in useBoardSocket, so a
// cursor moving only re-renders this (CursorOverlay), not the whole
// BoardPage tree - cursor-update is by far the highest-frequency event any
// client receives (throttled to ~25/sec per other user), so where this
// state lives matters a lot more than it would for e.g. presence.
export function useCursorOverlay(socket: Socket | null) {
  const [cursors, setCursors] = useState<Record<number, CursorPosition>>({});
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewTransform>(() => getViewTransform(0, 0));

  // Cursor positions arrive in world units, like strokes, and have to be
  // mapped back to pixels to position a DOM element. The overlay is laid out
  // to cover exactly the same box as the canvas, so measuring it gives the
  // same transform the canvas is drawing with - without having to thread the
  // view down from Whiteboard, which is a sibling, not a parent.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    function measure() {
      const rect = el!.getBoundingClientRect();
      setView(getViewTransform(rect.width, rect.height));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  return { cursors, overlayRef, view };
}
