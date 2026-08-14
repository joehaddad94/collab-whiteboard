import { db } from "../../db/index.js";

export interface ChatMessageRow {
  id: number;
  board_id: number;
  user_id: number;
  username: string;
  text: string;
  created_at: string;
}

export function insertMessage(
  boardId: number,
  userId: number,
  text: string,
): number {
  const result = db
    .prepare("INSERT INTO ChatMessage (board_id, user_id, text) VALUES (?, ?, ?)")
    .run(boardId, userId, text);
  return Number(result.lastInsertRowid);
}

export function findMessageById(id: number): ChatMessageRow | undefined {
  return db
    .prepare(
      `SELECT ChatMessage.id, ChatMessage.board_id, ChatMessage.user_id,
              User.username, ChatMessage.text, ChatMessage.created_at
       FROM ChatMessage
       JOIN User ON User.id = ChatMessage.user_id
       WHERE ChatMessage.id = ?`,
    )
    .get(id) as ChatMessageRow | undefined;
}

export function findRecentMessagesForBoard(
  boardId: number,
  limit: number,
): ChatMessageRow[] {
  return db
    .prepare(
      `SELECT ChatMessage.id, ChatMessage.board_id, ChatMessage.user_id,
              User.username, ChatMessage.text, ChatMessage.created_at
       FROM ChatMessage
       JOIN User ON User.id = ChatMessage.user_id
       WHERE ChatMessage.board_id = ?
       ORDER BY ChatMessage.created_at DESC, ChatMessage.id DESC
       LIMIT ?`,
    )
    .all(boardId, limit) as unknown as ChatMessageRow[];
}
