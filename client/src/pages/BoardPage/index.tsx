import { Whiteboard } from "../../components/Whiteboard";
import { Toolbar } from "../../components/Toolbar";
import { useBoardPage } from "./useBoardPage";

export function BoardPage() {
  const {
    board,
    loadError,
    socket,
    connected,
    connectedUsers,
    socketError,
    clearSocketError,
    userId,
    goBack,
    tool,
    setTool,
    color,
    setColor,
    brushSize,
    setBrushSize,
    undo,
    redo,
    clearBoard,
  } = useBoardPage();

  return (
    <div className="board-page">
      <div className="board-page-toolbar">
        <div className="board-title-group">
          <button type="button" className="btn btn-ghost" onClick={goBack}>
            &larr; Boards
          </button>
          <h2>{board?.name ?? "Loading board…"}</h2>
          <span className="connection-status">
            <span className={`dot ${connected ? "dot-success" : "dot-pending"}`} />
            {connected ? "Connected" : "Connecting…"}
          </span>
        </div>

        <div className="board-presence">
          {connectedUsers.length === 0 ? (
            <span className="board-presence-empty">No one else here yet</span>
          ) : (
            connectedUsers.map((u) => (
              <span key={u.userId} className="presence-chip">
                {u.displayName}
              </span>
            ))
          )}
        </div>
      </div>

      {loadError && <p className="form-error board-page-banner">{loadError}</p>}
      {socketError && (
        <p className="form-error board-page-banner">
          {socketError}{" "}
          <button type="button" className="btn btn-ghost btn-icon" onClick={clearSocketError}>
            Dismiss
          </button>
        </p>
      )}

      <div className="board-canvas-area">
        {userId !== null && (
          <>
            <Whiteboard
              userId={userId}
              tool={tool}
              color={color}
              brushSize={brushSize}
              socket={socket}
            />
            <Toolbar
              tool={tool}
              onToolChange={setTool}
              color={color}
              onColorChange={setColor}
              brushSize={brushSize}
              onBrushSizeChange={setBrushSize}
              onUndo={undo}
              onRedo={redo}
              onClear={clearBoard}
            />
          </>
        )}
      </div>
    </div>
  );
}
