import { Dialog } from "../Dialog";
import { Avatar } from "../Avatar";
import type { BoardMember, ConnectedUser } from "../../types";
import { usePeopleDialog } from "./usePeopleDialog";

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
          <label htmlFor="invite-email" className="people-invite-label">
            Invite someone with an account
          </label>
          <div className="people-invite-row">
            <input
              id="invite-email"
              type="email"
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={inviting || !email.trim()}
            >
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>
          {inviteMessage && (
            <p className="people-feedback is-success">{inviteMessage}</p>
          )}
          {inviteError && <p className="people-feedback is-error">{inviteError}</p>}
        </form>
      )}
    </Dialog>
  );
}
