import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../../hooks/useApi";

interface UseInvitePanelOptions {
  boardId: number;
  inviteCode?: string;
  onInviteCodeChange: (code: string) => void;
}

export function useInvitePanel({
  boardId,
  inviteCode,
  onInviteCodeChange,
}: UseInvitePanelOptions) {
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setInviting(true);
    setInviteError(null);
    setInviteMessage(null);
    try {
      const result = await api.boards.inviteMember(boardId, trimmed);
      setInviteMessage(`${result.displayName} added as ${result.role}`);
      setEmail("");
    } catch (err) {
      setInviteError(err instanceof ApiRequestError ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const { inviteCode: newCode } = await api.boards.regenerateInviteLink(boardId);
      onInviteCodeChange(newCode);
    } catch (err) {
      setInviteError(
        err instanceof ApiRequestError ? err.message : "Failed to regenerate link",
      );
    } finally {
      setRegenerating(false);
    }
  }

  const inviteLink = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  async function handleCopy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return {
    email,
    setEmail,
    inviting,
    inviteMessage,
    inviteError,
    handleInvite,
    regenerating,
    handleRegenerate,
    inviteLink,
    copied,
    handleCopy,
  };
}
