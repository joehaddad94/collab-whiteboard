import type { CSSProperties } from "react";
import type { CursorPosition } from "../types";

const CURSOR_COLORS = ["#ff6b4a", "#14b8a6", "#8b5cf6", "#f5a623"];

interface CursorOverlayProps {
  cursors: Record<number, CursorPosition>;
}

export function CursorOverlay({ cursors }: CursorOverlayProps) {
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
          <span className="cursor-flag-tag">{cursor.displayName}</span>
        </div>
      ))}
    </>
  );
}
