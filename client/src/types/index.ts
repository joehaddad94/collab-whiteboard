export interface User {
  id: number;
  email: string;
  displayName: string;
}

export type BoardRole = "owner" | "editor";

export interface BoardSummary {
  id: number;
  name: string;
  updated_at: string;
  role: BoardRole;
}

export interface BoardDetail {
  id: number;
  name: string;
  owner_id: number;
  data: Stroke[];
  created_at: string;
  updated_at: string;
  role: BoardRole;
}

export type Tool = "pen" | "eraser";

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  userId: number;
  tool: Tool;
  color: string;
  brushSize: number;
  points: Point[];
}

export interface ApiError {
  error: string;
}
