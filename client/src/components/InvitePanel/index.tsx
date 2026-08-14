import { CloseIcon } from "../icons";
import { useInvitePanel } from "./useInvitePanel";

interface InvitePanelProps {
  boardId: number;
  onClose: () => void;
}

export function InvitePanel({ boardId, onClose }: InvitePanelProps) {
  const { email, setEmail, inviting, inviteMessage, inviteError, handleInvite } =
    useInvitePanel({ boardId });

  return (
    <div className="invite-panel">
      <div className="invite-panel-head">
        <h3>Invite people</h3>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      <form className="invite-email-form" onSubmit={handleInvite}>
        <input
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
      </form>
      {inviteMessage && <p className="invite-feedback invite-feedback-success">{inviteMessage}</p>}
      {inviteError && <p className="invite-feedback invite-feedback-error">{inviteError}</p>}
    </div>
  );
}
