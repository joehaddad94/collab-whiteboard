import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { CursorPosition } from "../../types";
import { getViewTransform, type ViewTransform } from "../../lib/worldView";

// Cursor state lives here rather than in useBoardSocket, so a cursor moving
// only re-renders this overlay instead of the whole BoardPage tree.
// cursor-update is the highest-frequency event a client gets - ~25/sec per
// other user - so where the state sits matters more than it would for presence.
export function useCursorOverlay(socket: Socket | null) {
  const [cursors, setCursors] = useState<Record<number, CursorPosition>>({});
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewTransform>(() => getViewTransform(0, 0));

  // Cursor positions arrive in world units like strokes, and need mapping
  // back to pixels to place a DOM element. The overlay covers exactly the
  // same box as the canvas, so measuring it gives the same transform - no
  // need to thread the view down from Whiteboard, which is a sibling anyway.
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
