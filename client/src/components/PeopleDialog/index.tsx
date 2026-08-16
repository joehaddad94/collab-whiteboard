import { useId } from "react";
import { Dialog } from "../Dialog";
import { Avatar } from "../Avatar";
import type { BoardMember, ConnectedUser } from "../../types";
import { usePeopleDialog, type InviteeStatus } from "./usePeopleDialog";

function statusMessage(status: InviteeStatus): string {
  switch (status.kind) {
    case "checking":
      return "Checking…";
    case "missing":
      return "No account with that username";
    case "self":
      return "That's you — you already own this board";
    case "member":
      return "Already on this board";
    case "ok":
      return `${status.username} found`;
    // "unknown" means the check itself failed. Saying nothing is right: the
    // invite still works, and a warning about a failed check would only be
    // noise the user can't act on.
    default:
      return "";
  }
}

function statusTone(kind: InviteeStatus["kind"]): string {
  if (kind === "ok") return "is-success";
  if (kind === "missing" || kind === "self") return "is-error";
  return "is-muted";
}

interface PeopleDialogProps {
  boardId: number;
  members: BoardMember[];
  membersLoading: boolean;
  membersError: string | null;
  connectedUsers: ConnectedUser[];
  currentUserId: number | null;
  /** Owners get the invite field and the per-row actions; everyone else can
      still see who has access, and can leave. */
  canManage: boolean;
  onMembersChanged: () => Promise<void> | void;
  onLeft: () => void;
  onClose: () => void;
}

export function PeopleDialog({
  boardId,
  members,
  membersLoading,
  membersError,
  connectedUsers,
  currentUserId,
  canManage,
  onMembersChanged,
  onLeft,
  onClose,
}: PeopleDialogProps) {
  const {
    people,
    username,
    setUsername,
    inviteeStatus,
    canInvite,
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
  } = usePeopleDialog({ boardId, members, connectedUsers, onMembersChanged });

  // Generated rather than hardcoded, for the same reason the dialog title is.
  const usernameId = useId();
  const statusId = useId();

  async function handleLeave(userId: number) {
    if (await leaveBoard(userId)) onLeft();
  }

  return (
    <Dialog title="People" onClose={onClose} showCloseButton className="people-dialog">
      {/* An empty list and a failed fetch look identical, so they have to say
          which they are - otherwise a broken request reads as "nobody has
          access to this board", which is never true. */}
      {membersLoading && <p className="people-state">Loading people…</p>}

      {!membersLoading && membersError && (
        <p className="people-state is-error">{membersError}</p>
      )}

      {!membersLoading && !membersError && (
        <ul className="people-list">
          {people.map((person) => {
            const isSelf = person.userId === currentUserId;
            const isBusy = busyId === person.userId;

            return (
              <li key={person.userId} className="people-row">
                <span className="people-row-avatar">
                  <Avatar name={person.username} userId={person.userId} size={28} />
                  {person.isOnline && (
                    <span
                      className="people-online-dot"
                      role="img"
                      aria-label="On the board now"
                      title="On the board now"
                    />
                  )}
                </span>

                <span className="people-row-name">
                  {isSelf ? "You" : person.username}
                </span>
                <span className="role-badge">{person.role}</span>

                <span className="people-row-actions">
                  {pendingRemovalId === person.userId ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-danger btn-sm"
                        onClick={() =>
                          void (isSelf
                            ? handleLeave(person.userId)
                            : confirmRemove(person.userId))
                        }
                        disabled={isBusy}
                      >
                        {isBusy ? "Working…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={cancelRemove}
                        disabled={isBusy}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Anyone can leave; only the owner can remove someone
                          else. The owner can't leave their own board - they
                          delete it instead. */}
                      {isSelf && person.role !== "owner" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-danger btn-sm"
                          onClick={() => requestRemove(person.userId)}
                        >
                          Leave
                        </button>
                      )}
                      {canManage && !isSelf && person.role !== "owner" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-danger btn-sm"
                          onClick={() => requestRemove(person.userId)}
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </span>

                {rowError?.userId === person.userId && (
                  <span className="people-row-error">{rowError.message}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <form className="people-invite-form" onSubmit={handleInvite}>
          <label htmlFor={usernameId} className="people-invite-label">
            Invite by username
          </label>
          <div className="people-invite-row">
            <input
              id={usernameId}
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={!canInvite}>
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>

          {/* A live region rather than aria-describedby: the text appears in
              response to typing, not to the field being focused, and pairing
              both tends to get it announced twice. */}
          <p
            id={statusId}
            className={`people-feedback ${statusTone(inviteeStatus.kind)}`}
            aria-live="polite"
          >
            {statusMessage(inviteeStatus)}
          </p>

          {inviteMessage && (
            <p className="people-feedback is-success">{inviteMessage}</p>
          )}
          {inviteError && <p className="people-feedback is-error">{inviteError}</p>}
        </form>
      ) : (
        <p className="people-note">
          Only the board owner can invite or remove people.
        </p>
      )}
    </Dialog>
  );
}
