import { memo } from "react";
import type { Socket } from "socket.io-client";
import type { Stroke, Tool } from "../../types";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../../lib/worldView";
import { useWhiteboard } from "./useWhiteboard";

interface WhiteboardProps {
  userId: number;
  tool: Tool;
  color: string;
  brushSize: number;
  socket: Socket | null;
  disabled?: boolean;
  onStrokesChange?: (strokes: Stroke[]) => void;
}

export const Whiteboard = memo(function Whiteboard({
  userId,
  tool,
  color,
  brushSize,
  socket,
  disabled = false,
  onStrokesChange,
}: WhiteboardProps) {
  const { containerRef, canvasRef, view, handlePointerDown, handlePointerMove, handlePointerUp } =
    useWhiteboard({ userId, tool, color, brushSize, socket, disabled, onStrokesChange });

  return (
    <div
      ref={containerRef}
      className={`whiteboard-container tool-${tool} ${disabled ? "is-disabled" : ""}`}
    >
      {/* The drawable surface is a fixed-aspect page scaled to fit, so it
          needs to be visible - otherwise the margin beside it on a window
          that doesn't match its shape looks drawable but silently isn't. */}
      <div
        className="whiteboard-page"
        style={{
          left: view.offsetX,
          top: view.offsetY,
          width: WORLD_WIDTH * view.scale,
          height: WORLD_HEIGHT * view.scale,
        }}
      />
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
});
