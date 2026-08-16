import { Whiteboard } from "../../components/Whiteboard";
import { Toolbar } from "../../components/Toolbar";
import { CursorOverlay } from "../../components/CursorOverlay";
import { UserList } from "../../components/UserList";
import { PeopleDialog } from "../../components/PeopleDialog";
import { ChatPanel } from "../../components/ChatPanel";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { BackIcon, ChatIcon } from "../../components/icons";
import { useBoardPage } from "./useBoardPage";

export function BoardPage() {
  const {
    board,
    loadError,
    socket,
    connected,
    hasConnected,
    connectedUsers,
    members,
    membersLoading,
    membersError,
    onlineMembers,
    refreshMembers,
    handleLeftBoard,
    messages,
    sendMessage,
    socketError,
    clearSocketError,
    saveStatus,
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
    requestClearBoard,
    confirmClearBoard,
    cancelClearBoard,
    showClearConfirm,
    showPeople,
    setShowPeople,
    showChat,
    setShowChat,
  } = useBoardPage();

  return (
    <div className="board-page">
      <div className="board-page-toolbar">
        <div className="board-title-group">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={goBack}
            aria-label="Back to boards"
            title="Back to boards"
          >
            <BackIcon />
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
            {saveStatus === "unsaved" ? "Unsaved changes" : "Saved"}
          </span>
        </div>

        <div className="board-presence">
          <UserList members={onlineMembers} currentUserId={userId ?? -1} />
          <button
            type="button"
            className={`btn btn-ghost ${showPeople ? "btn-active" : ""}`}
            onClick={() => setShowPeople((prev) => !prev)}
          >
            People
            {members.length > 0 && (
              <span className="btn-count">{members.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-icon ${showChat ? "btn-active" : ""}`}
            onClick={() => setShowChat((prev) => !prev)}
            aria-label="Toggle chat"
            title="Toggle chat"
          >
            <ChatIcon />
          </button>
        </div>
      </div>

      {showPeople && board && (
        <PeopleDialog
          boardId={board.id}
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          connectedUsers={connectedUsers}
          currentUserId={userId}
          canManage={board.role === "owner"}
          onMembersChanged={refreshMembers}
          onLeft={handleLeftBoard}
          onClose={() => setShowPeople(false)}
        />
      )}

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear the whole board?"
          message="This removes every stroke for everyone on this board. It can't be undone."
          confirmLabel="Clear board"
          danger
          onConfirm={confirmClearBoard}
          onCancel={cancelClearBoard}
        />
      )}

      {loadError && (
        <p className="form-error board-page-banner" role="alert">
          {loadError}
        </p>
      )}
      {/* A board that failed to load also fails to join, so both errors fire
          for one problem - two stacked banners saying the same thing, pushing
          the canvas down. The load failure is the one that explains it. */}
      {!loadError && socketError && (
        <p className="form-error board-page-banner" role="alert">
          {socketError}{" "}
          <button type="button" className="btn btn-ghost" onClick={clearSocketError}>
            Dismiss
          </button>
        </p>
      )}

      <div className="board-canvas-area">
        <div className="board-canvas-region">
          {/* Drawing while disconnected would be discarded without warning:
              the server never receives it, and the next board-joined replaces
              local state wholesale. Say so and stop accepting input, rather
              than letting the work disappear silently. */}
          {!connected && (
            <div className="canvas-paused" role="status">
              <span className="dot dot-pending" />
              {hasConnected
                ? "Reconnecting — drawing paused"
                : "Connecting — drawing paused"}
            </div>
          )}

          {userId !== null && (
            <>
              <Whiteboard
                userId={userId}
                tool={tool}
                color={color}
                brushSize={brushSize}
                socket={socket}
                disabled={!connected}
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
                onClear={requestClearBoard}
              />
              <CursorOverlay socket={socket} />
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
