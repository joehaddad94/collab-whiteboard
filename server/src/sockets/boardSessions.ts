import type { Stroke } from "../modules/boards/boards.types.js";

export interface ConnectedUser {
  userId: number;
  username: string;
}

export interface BoardSession {
  strokes: Stroke[];
  inProgressStrokes: Map<string, Stroke>;
  undoStack: Map<number, Stroke[]>;
  redoStack: Map<number, Stroke[]>;
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

// connectedUsers is keyed by socket id, not user id, because eviction and
// disconnect both work per-socket - but the same user can hold several sockets
// on one board (two tabs, or a reconnect racing the old socket's cleanup).
// Presence is a per-user concept, so it goes through these two helpers rather
// than reading the map directly.
export function listUniqueUsers(session: BoardSession): ConnectedUser[] {
  const byUserId = new Map<number, ConnectedUser>();
  for (const user of session.connectedUsers.values()) {
    if (!byUserId.has(user.userId)) byUserId.set(user.userId, user);
  }
  return Array.from(byUserId.values());
}

export function hasUserConnection(
  session: BoardSession,
  userId: number,
): boolean {
  for (const user of session.connectedUsers.values()) {
    if (user.userId === userId) return true;
  }
  return false;
}

export function removeSessionIfEmpty(boardId: number): void {
  const session = sessions.get(boardId);
  if (session && session.connectedUsers.size === 0) {
    sessions.delete(boardId);
  }
}
