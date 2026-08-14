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

export function removeSessionIfEmpty(boardId: number): void {
  const session = sessions.get(boardId);
  if (session && session.connectedUsers.size === 0) {
    sessions.delete(boardId);
  }
}
