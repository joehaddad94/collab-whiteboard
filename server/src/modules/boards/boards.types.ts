export interface Stroke {
  id: string;
  userId: number;
  tool: "pen" | "eraser";
  color: string;
  brushSize: number;
  points: { x: number; y: number }[];
}
