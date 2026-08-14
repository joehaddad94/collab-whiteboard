import type { ChatMessage } from "../../types";
import { CloseIcon } from "../icons";
import { Avatar } from "../Avatar";
import { useChatPanel } from "./useChatPanel";

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: number;
  onSend: (text: string) => void;
  onClose: () => void;
}

function formatTime(createdAt: string): string {
  // SQLite's datetime('now') is UTC, space-separated with no offset -
  // reparse as ISO/UTC so it doesn't get misread as local time.
  const date = new Date(`${createdAt.replace(" ", "T")}Z`);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({ messages, currentUserId, onSend, onClose }: ChatPanelProps) {
  const { text, setText, listRef, handleSubmit } = useChatPanel({ messages, onSend });

  return (
    <aside className="chat-panel">
      <div className="chat-head">
        Board chat
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onClose}
          aria-label="Close chat"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 ? (
          <p className="chat-empty">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="chat-msg">
              <Avatar name={m.username} userId={m.userId} size={24} />
              <div className="chat-msg-body">
                <div className="chat-msg-who">
                  <span className="chat-msg-name">
                    {m.userId === currentUserId ? "You" : m.username}
                  </span>
                  <span className="chat-msg-time">{formatTime(m.createdAt)}</span>
                </div>
                <div className="chat-msg-text">{m.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the board…"
          maxLength={2000}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
