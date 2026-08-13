import { useInvitePanel } from "./useInvitePanel";

interface InvitePanelProps {
  boardId: number;
  inviteCode?: string;
  onInviteCodeChange: (code: string) => void;
  onClose: () => void;
}

export function InvitePanel({
  boardId,
  inviteCode,
  onInviteCodeChange,
  onClose,
}: InvitePanelProps) {
  const {
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
  } = useInvitePanel({ boardId, inviteCode, onInviteCodeChange });

  return (
    <div className="invite-panel">
      <div className="invite-panel-head">
        <h3>Invite people</h3>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>
          ×
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

      <div className="invite-link-row">
        <input
          type="text"
          readOnly
          value={inviteLink ?? ""}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void handleCopy()}
          disabled={!inviteLink}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void handleRegenerate()}
          disabled={regenerating}
        >
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    </div>
  );
}
