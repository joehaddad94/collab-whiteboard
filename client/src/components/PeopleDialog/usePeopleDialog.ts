import { useMemo, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../../hooks/useApi";
import type { BoardMember, ConnectedUser } from "../../types";

interface UsePeopleDialogOptions {
  boardId: number;
  members: BoardMember[];
  connectedUsers: ConnectedUser[];
  onMembersChanged: () => Promise<void> | void;
}

export interface PersonRow extends BoardMember {
  isOnline: boolean;
}

export function usePeopleDialog({
  boardId,
  members,
  connectedUsers,
  onMembersChanged,
}: UsePeopleDialogOptions) {
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [pendingRemovalId, setPendingRemovalId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Online status is derived from the same live socket state the header chips
  // use, so the list stays current while the dialog is open without this hook
  // subscribing to anything itself.
  const people = useMemo<PersonRow[]>(() => {
    const onlineIds = new Set(connectedUsers.map((u) => u.userId));
    return members
      .map((m) => ({ ...m, isOnline: onlineIds.has(m.userId) }))
      // The server orders by role, and "editor" sorts before "owner"
      // alphabetically, which puts the owner last. Owner first reads better.
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
        return a.username.localeCompare(b.username);
      });
  }, [members, connectedUsers]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setInviting(true);
    setInviteError(null);
    setInviteMessage(null);
    try {
      const result = await api.boards.inviteMember(boardId, trimmed);
      // Refreshing is the real feedback - the person appears in the list
      // above. The message just names what happened.
      await onMembersChanged();
      setInviteMessage(`${result.username} can now edit this board`);
      setEmail("");
    } catch (err) {
      setInviteError(
        err instanceof ApiRequestError ? err.message : "Failed to invite",
      );
    } finally {
      setInviting(false);
    }
  }

  function requestRemove(userId: number) {
    setRemoveError(null);
    setPendingRemovalId(userId);
  }

  function cancelRemove() {
    setPendingRemovalId(null);
  }

  async function confirmRemove(userId: number) {
    setRemovingId(userId);
    setRemoveError(null);
    try {
      await api.boards.removeMember(boardId, userId);
      await onMembersChanged();
      setPendingRemovalId(null);
    } catch (err) {
      setRemoveError(
        err instanceof ApiRequestError ? err.message : "Failed to remove",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return {
    people,
    email,
    setEmail,
    inviting,
    inviteMessage,
    inviteError,
    handleInvite,
    pendingRemovalId,
    removingId,
    removeError,
    requestRemove,
    cancelRemove,
    confirmRemove,
  };
}
