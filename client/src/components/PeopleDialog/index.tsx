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
  connectedUsers: ConnectedUser[];
  currentUserId: number | null;
  /** Owners get the invite field and the remove actions; everyone else can
      still see who has access. */
  canManage: boolean;
  onMembersChanged: () => Promise<void> | void;
  onClose: () => void;
}

export function PeopleDialog({
  boardId,
  members,
  connectedUsers,
  currentUserId,
  canManage,
  onMembersChanged,
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
    removingId,
    removeError,
    requestRemove,
    cancelRemove,
    confirmRemove,
  } = usePeopleDialog({ boardId, members, connectedUsers, onMembersChanged });

  return (
    <Dialog title="People" onClose={onClose} showCloseButton className="people-dialog">
      <ul className="people-list">
        {people.map((person) => (
          <li key={person.userId} className="people-row">
            <span className="people-row-avatar">
              <Avatar name={person.username} userId={person.userId} size={28} />
              {person.isOnline && (
                <span className="people-online-dot" title="On the board now" />
              )}
            </span>

            <span className="people-row-name">
              {person.userId === currentUserId ? "You" : person.username}
            </span>
            <span className="role-badge">{person.role}</span>

            {/* The owner can't be removed - the server rejects it - so the
                action isn't offered rather than offered and then refused. */}
            {canManage && person.role !== "owner" && (
              <span className="people-row-actions">
                {pendingRemovalId === person.userId ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger btn-sm"
                      onClick={() => void confirmRemove(person.userId)}
                      disabled={removingId === person.userId}
                    >
                      {removingId === person.userId ? "Removing…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={cancelRemove}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger btn-sm"
                    onClick={() => requestRemove(person.userId)}
                  >
                    Remove
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      {removeError && <p className="people-feedback is-error">{removeError}</p>}

      {canManage && (
        <form className="people-invite-form" onSubmit={handleInvite}>
          <label htmlFor="invite-username" className="people-invite-label">
            Invite by username
          </label>
          <div className="people-invite-row">
            <input
              id="invite-username"
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby="invite-status"
              required
            />
            <button type="submit" className="btn btn-primary" disabled={!canInvite}>
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>

          {/* aria-live so the result of the check is announced, not just
              shown - it appears without the user doing anything to ask. */}
          <p
            id="invite-status"
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
      )}
    </Dialog>
  );
}
