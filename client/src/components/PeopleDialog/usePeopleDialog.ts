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
  const [busyId, setBusyId] = useState<number | null>(null);
  // Keyed by user so the message lands in its own row - under the list, it
  // can scroll out of sight of whatever caused it.
  const [rowError, setRowError] = useState<{
    userId: number;
    message: string;
  } | null>(null);

  // Online status comes from the same socket state the header chips use, so
  // the list stays current while the dialog is open without subscribing to
  // anything here.
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

  // Checks the username against the server as you type, so "no such user"
  // shows up while you can still fix it. Debounced, and each run cancels the
  // last one's result - responses can land out of order, and a stale one
  // would overwrite a newer answer.
  useEffect(() => {
    // Whatever the last invite said is about the previous name, not this one.
    setInviteMessage(null);
    setInviteError(null);

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
  }, [username, boardId]);

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
    setRowError(null);
    setPendingRemovalId(userId);
  }

  function cancelRemove() {
    setPendingRemovalId(null);
  }

  async function runRowAction(
    userId: number,
    action: () => Promise<unknown>,
    fallbackMessage: string,
  ) {
    setBusyId(userId);
    setRowError(null);
    try {
      await action();
      await onMembersChanged();
      setPendingRemovalId(null);
      return true;
    } catch (err) {
      setRowError({
        userId,
        message:
          err instanceof ApiRequestError ? err.message : fallbackMessage,
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const confirmRemove = (userId: number) =>
    runRowAction(
      userId,
      () => api.boards.removeMember(boardId, userId),
      "Failed to remove",
    );

  // Leaving is removing yourself - same endpoint, which the server allows
  // for your own membership.
  const leaveBoard = (userId: number) =>
    runRowAction(
      userId,
      () => api.boards.removeMember(boardId, userId),
      "Failed to leave",
    );

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
    busyId,
    rowError,
    requestRemove,
    cancelRemove,
    confirmRemove,
    leaveBoard,
  };
}
