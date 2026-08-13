import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "../../types";

interface UseChatPanelOptions {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function useChatPanel({ messages, onSend }: UseChatPanelOptions) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return { text, setText, listRef, handleSubmit };
}
