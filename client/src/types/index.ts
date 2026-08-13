// Shared shapes mirroring the server's actual implementation (server/src/routes/*.ts,
// server/src/db/schema.sql). Deliberately duplicated rather than imported — see ADR-013.
// Kept in sync by hand; if a server response shape changes, update here too.

export interface User {
  id: number;
  username: string;
}

export type BoardRole = "owner" | "editor";

// GET /api/boards — list item (no `data` blob, per ADR-016)
export interface BoardSummary {
  id: number;
  name: string;
  updated_at: string;
  role: BoardRole;
}

// GET /api/boards/:id — full board including parsed strokes
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

// Matches ADR-006's Stroke shape, used both in Board.data and (once built) socket payloads.
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
