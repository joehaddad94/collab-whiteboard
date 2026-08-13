export interface Stroke {
  id: string;
  userId: number;
  tool: "pen" | "eraser";
  color: string;
  brushSize: number;
  points: { x: number; y: number }[];
}

function isValidPoint(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { x?: unknown }).x === "number" &&
    typeof (value as { y?: unknown }).y === "number"
  );
}

export function isValidStroke(value: unknown): value is Stroke {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.userId === "number" &&
    (s.tool === "pen" || s.tool === "eraser") &&
    typeof s.color === "string" &&
    typeof s.brushSize === "number" &&
    Array.isArray(s.points) &&
    s.points.every(isValidPoint)
  );
}
