import { Header } from "../../components/Header";
import { useBoardPage } from "./useBoardPage";

export function BoardPage() {
  const {
    board,
    loadError,
    connected,
    connectedUsers,
    socketError,
    clearSocketError,
    goBack,
  } = useBoardPage();

  return (
    <div className="page">
      <Header />
      <div className="board-page-toolbar">
        <button type="button" onClick={goBack}>
          &larr; Back to boards
        </button>
        <h2>{board?.name ?? "Loading board…"}</h2>
        <span className="connection-status">
          {connected ? "Connected" : "Connecting…"}
        </span>
      </div>

      {loadError && <p className="form-error">{loadError}</p>}
      {socketError && (
        <p className="form-error">
          {socketError}{" "}
          <button type="button" onClick={clearSocketError}>
            Dismiss
          </button>
        </p>
      )}

      <div className="board-presence">
        {connectedUsers.length === 0 ? (
          <p>No one else here yet.</p>
        ) : (
          <ul>
            {connectedUsers.map((u) => (
              <li key={u.userId}>{u.displayName}</li>
            ))}
          </ul>
        )}
      </div>

      <p className="board-placeholder">Canvas coming next.</p>
    </div>
  );
}
