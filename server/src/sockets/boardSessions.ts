// In-memory per-board session state (ADR-017). Hydrated from Board.data on first
// join, evicted once the last connected client leaves — never persisted directly;
// only an explicit save (PUT /api/boards/:id/data) writes back to SQLite.

export interface Stroke {
  id: string;
  userId: number;
  tool: "pen" | "eraser";
  color: string;
  brushSize: number;
  points: { x: number; y: number }[];
}

export interface ConnectedUser {
  userId: number;
  username: string;
}

export interface BoardSession {
  strokes: Stroke[];
  // Strokes currently being drawn (between stroke-start and stroke-end), keyed by
  // strokeId. stroke-end's payload is just { strokeId } (ADR-017), so the server
  // must accumulate the points itself from stroke-start/stroke-point to know what
  // to move into `strokes` once the stroke finishes.
  inProgressStrokes: Map<string, Stroke>;
  // Keyed by userId — undo/redo is per-user (ADR-007), not global.
  undoStack: Map<number, Stroke[]>;
  redoStack: Map<number, Stroke[]>;
  // Keyed by socket.id, since one user could theoretically hold multiple sockets
  // (e.g. two tabs) — presence is tracked per connection, not per user.
  connectedUsers: Map<string, ConnectedUser>;
}

const sessions = new Map<number, BoardSession>();

export function getSession(boardId: number): BoardSession | undefined {
  return sessions.get(boardId);
}

export function getOrCreateSession(
  boardId: number,
  hydrate: () => Stroke[],
): BoardSession {
  let session = sessions.get(boardId);
  if (!session) {
    session = {
      strokes: hydrate(),
      inProgressStrokes: new Map(),
      undoStack: new Map(),
      redoStack: new Map(),
      connectedUsers: new Map(),
    };
    sessions.set(boardId, session);
  }
  return session;
}

export function removeSessionIfEmpty(boardId: number): void {
  const session = sessions.get(boardId);
  if (session && session.connectedUsers.size === 0) {
    sessions.delete(boardId);
  }
}
