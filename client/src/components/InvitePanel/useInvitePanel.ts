import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../../hooks/useApi";

interface UseInvitePanelOptions {
  boardId: number;
}

export function useInvitePanel({ boardId }: UseInvitePanelOptions) {
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setInviting(true);
    setInviteError(null);
    setInviteMessage(null);
    try {
      const result = await api.boards.inviteMember(boardId, trimmed);
      setInviteMessage(`${result.username} added as ${result.role}`);
      setEmail("");
    } catch (err) {
      setInviteError(err instanceof ApiRequestError ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  }

  return {
    email,
    setEmail,
    inviting,
    inviteMessage,
    inviteError,
    handleInvite,
  };
}
