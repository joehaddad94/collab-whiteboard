import { ValidationError } from "../../errors.js";
import * as chatRepository from "./chat.repository.js";
import type { ChatMessageRow } from "./chat.repository.js";

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_LIMIT = 50;

export interface ChatMessage {
  id: number;
  boardId: number;
  userId: number;
  username: string;
  text: string;
  createdAt: string;
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    boardId: row.board_id,
    userId: row.user_id,
    username: row.username,
    text: row.text,
    createdAt: row.created_at,
  };
}

export function sendMessage(
  boardId: number,
  userId: number,
  rawText: unknown,
): ChatMessage {
  if (typeof rawText !== "string") {
    throw new ValidationError("Message text is required");
  }
  const text = rawText.trim();
  if (text.length === 0 || text.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(
      `Message must be 1-${MAX_MESSAGE_LENGTH} characters`,
    );
  }

  const id = chatRepository.insertMessage(boardId, userId, text);
  return toChatMessage(chatRepository.findMessageById(id)!);
}

export function getRecentMessages(boardId: number): ChatMessage[] {
  const rows = chatRepository.findRecentMessagesForBoard(
    boardId,
    HISTORY_LIMIT,
  );
  return rows.reverse().map(toChatMessage);
}
