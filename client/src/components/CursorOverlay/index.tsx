import type { CSSProperties } from "react";
import type { Socket } from "socket.io-client";
import { useCursorOverlay } from "./useCursorOverlay";

const CURSOR_COLORS = ["#ff6b4a", "#14b8a6", "#8b5cf6", "#f5a623"];

interface CursorOverlayProps {
  socket: Socket | null;
}

export function CursorOverlay({ socket }: CursorOverlayProps) {
  const cursors = useCursorOverlay(socket);

  return (
    <>
      {Object.values(cursors).map((cursor) => (
        <div
          key={cursor.userId}
          className="cursor-flag"
          style={
            {
              left: cursor.x,
              top: cursor.y,
              "--cursor-color": CURSOR_COLORS[cursor.userId % CURSOR_COLORS.length],
            } as CSSProperties
          }
        >
          <span className="cursor-flag-tip" />
          <span className="cursor-flag-tag">{cursor.username}</span>
        </div>
      ))}
    </>
  );
}
