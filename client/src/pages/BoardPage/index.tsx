import { Whiteboard } from "../../components/Whiteboard";
import { Toolbar } from "../../components/Toolbar";
import { CursorOverlay } from "../../components/CursorOverlay";
import { UserList } from "../../components/UserList";
import { InvitePanel } from "../../components/InvitePanel";
import { ChatPanel } from "../../components/ChatPanel";
import { useBoardPage } from "./useBoardPage";

export function BoardPage() {
  const {
    board,
    loadError,
    socket,
    connected,
    onlineMembers,
    cursors,
    messages,
    sendMessage,
    socketError,
    clearSocketError,
    saveStatus,
    saveError,
    save,
    handleStrokesChange,
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
    showInvitePanel,
    setShowInvitePanel,
    updateInviteCode,
    showChat,
    setShowChat,
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
          <span className="save-status">
            <span
              className={`dot ${saveStatus === "unsaved" ? "dot-pending" : "dot-success"}`}
            />
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "unsaved"
                ? "Unsaved changes"
                : "Saved"}
          </span>
        </div>

        <div className="board-presence">
          <UserList members={onlineMembers} />
          {board?.role === "owner" && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowInvitePanel((prev) => !prev)}
            >
              Invite
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowChat((prev) => !prev)}
          >
            Chat
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={saveStatus === "saving"}
          >
            {saveStatus === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {showInvitePanel && board && (
        <InvitePanel
          boardId={board.id}
          inviteCode={board.inviteCode}
          onInviteCodeChange={updateInviteCode}
          onClose={() => setShowInvitePanel(false)}
        />
      )}

      {loadError && <p className="form-error board-page-banner">{loadError}</p>}
      {saveError && <p className="form-error board-page-banner">{saveError}</p>}
      {socketError && (
        <p className="form-error board-page-banner">
          {socketError}{" "}
          <button type="button" className="btn btn-ghost btn-icon" onClick={clearSocketError}>
            Dismiss
          </button>
        </p>
      )}

      <div className="board-canvas-area">
        <div className="board-canvas-region">
          {userId !== null && (
            <>
              <Whiteboard
                userId={userId}
                tool={tool}
                color={color}
                brushSize={brushSize}
                socket={socket}
                onStrokesChange={handleStrokesChange}
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
              <CursorOverlay cursors={cursors} />
            </>
          )}
        </div>

        {showChat && userId !== null && (
          <ChatPanel
            messages={messages}
            currentUserId={userId}
            onSend={sendMessage}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>
    </div>
  );
}
