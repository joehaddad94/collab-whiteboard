import type { Tool } from "../../types";
import { useWhiteboard } from "./useWhiteboard";

interface WhiteboardProps {
  userId: number;
  tool: Tool;
  color: string;
  brushSize: number;
}

export function Whiteboard({ userId, tool, color, brushSize }: WhiteboardProps) {
  const { containerRef, canvasRef, handlePointerDown, handlePointerMove, handlePointerUp } =
    useWhiteboard({ userId, tool, color, brushSize });

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
