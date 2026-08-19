import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { CursorPosition } from "../../types";
import { getViewTransform, type ViewTransform } from "../../lib/worldView";

export function useCursorOverlay(socket: Socket | null) {
  const [cursors, setCursors] = useState<Record<number, CursorPosition>>({});
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewTransform>(() => getViewTransform(0, 0));

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
