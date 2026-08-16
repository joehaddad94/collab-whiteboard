import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../../hooks/useApi";
import type { BoardMember, ConnectedUser } from "../../types";

const LOOKUP_DEBOUNCE_MS = 350;

export type InviteeStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "unknown" }
  | { kind: "missing" }
  | { kind: "self" }
  | { kind: "member" }
  | { kind: "ok"; username: string };

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
  const [username, setUsername] = useState("");
  const [inviteeStatus, setInviteeStatus] = useState<InviteeStatus>({
    kind: "idle",
  });
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

  // Checks the typed username against the server as you go, so "no such user"
  // arrives while you can still fix it instead of after you commit. Debounced,
  // and every run cancels the previous one's result - responses can land out
  // of order, and a stale one would otherwise overwrite a newer answer.
  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setInviteeStatus({ kind: "idle" });
      return;
    }

    let cancelled = false;
    setInviteeStatus({ kind: "checking" });

    const timer = setTimeout(() => {
      api.boards
        .lookupInvitee(boardId, trimmed)
        .then((result) => {
          if (cancelled) return;
          if (!result.exists) setInviteeStatus({ kind: "missing" });
          else if (result.isSelf) setInviteeStatus({ kind: "self" });
          else if (result.alreadyMember) setInviteeStatus({ kind: "member" });
          else setInviteeStatus({ kind: "ok", username: result.username });
        })
        .catch(() => {
          // The check is an aid, not a gate - if it fails, say nothing and let
          // the invite itself be the authority.
          if (!cancelled) setInviteeStatus({ kind: "unknown" });
        });
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, boardId, members]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
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
      setUsername("");
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
    username,
    setUsername,
    inviteeStatus,
    // Only block on a definite "this can't work" - a failed or in-flight check
    // shouldn't stop you submitting, since the invite validates server-side
    // anyway.
    canInvite:
      username.trim().length > 0 &&
      !inviting &&
      inviteeStatus.kind !== "missing" &&
      inviteeStatus.kind !== "self" &&
      inviteeStatus.kind !== "member",
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
