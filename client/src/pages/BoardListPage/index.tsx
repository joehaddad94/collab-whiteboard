import { Link } from "react-router-dom";
import { Header } from "../../components/Header";
import { BoardThumbnail } from "../../components/BoardThumbnail";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useBoardListPage } from "./useBoardListPage";

export function BoardListPage() {
  const {
    boards,
    loading,
    error,
    newBoardName,
    setNewBoardName,
    creating,
    handleCreate,
    renamingId,
    renameValue,
    setRenameValue,
    startRename,
    cancelRename,
    handleRename,
    confirmDeleteId,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useBoardListPage();

  return (
    <div className="page">
      <Header />
      <main className="board-list-page">
        <h1>Your boards</h1>

        <form className="new-board-form" onSubmit={handleCreate}>
          <input
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder="New board name"
            maxLength={100}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={creating || !newBoardName.trim()}
          >
            {creating ? "Creating…" : "Create board"}
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p>Loading boards…</p>
        ) : boards.length === 0 ? (
          <p className="empty-state">No boards yet — create one above.</p>
        ) : (
          <ul className="board-list">
            {boards.map((board) => (
              <li key={board.id} className="board-list-item">
                {renamingId === board.id ? (
                  <>
                    <BoardThumbnail boardId={board.id} />
                    <div className="board-rename-form">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        maxLength={100}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleRename(board.id)}
                      >
                        Save
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={cancelRename}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link to={`/boards/${board.id}`} className="board-list-link">
                      <BoardThumbnail boardId={board.id} />
                      <div className="board-list-link-info">
                        <span className="board-name">{board.name}</span>
                        <span className="board-role">{board.role}</span>
                      </div>
                    </Link>
                    {board.role === "owner" && (
                      <div className="board-list-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => startRename(board)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-danger"
                          onClick={() => requestDelete(board.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {confirmDeleteId !== null && (
        <ConfirmDialog
          title="Delete this board?"
          message="This can't be undone."
          confirmLabel="Delete board"
          danger
          onConfirm={() => void confirmDelete()}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}
