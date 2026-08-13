import type { Socket } from "socket.io-client";
import type { Tool } from "../../types";
import { useWhiteboard } from "./useWhiteboard";

interface WhiteboardProps {
  userId: number;
  tool: Tool;
  color: string;
  brushSize: number;
  socket: Socket | null;
}

export function Whiteboard({ userId, tool, color, brushSize, socket }: WhiteboardProps) {
  const { containerRef, canvasRef, handlePointerDown, handlePointerMove, handlePointerUp } =
    useWhiteboard({ userId, tool, color, brushSize, socket });

  return (
    <div ref={containerRef} className="whiteboard-container">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
