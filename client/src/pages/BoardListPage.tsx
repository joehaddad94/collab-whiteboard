import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../hooks/useApi";
import { Header } from "../components/Header";
import type { BoardSummary } from "../types";

export function BoardListPage() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    refreshBoards();
  }, []);

  async function refreshBoards() {
    setLoading(true);
    try {
      const list = await api.boards.list();
      setBoards(list);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load boards");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api.boards.create(name);
      setNewBoardName("");
      await refreshBoards();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to create board");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: number) {
    const name = renameValue.trim();
    if (!name) return;
    try {
      await api.boards.rename(id, name);
      setRenamingId(null);
      await refreshBoards();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to rename board");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this board? This can't be undone.")) return;
    try {
      await api.boards.remove(id);
      await refreshBoards();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to delete board");
    }
  }

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
          <button type="submit" disabled={creating || !newBoardName.trim()}>
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
                  <div className="board-rename-form">
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      maxLength={100}
                    />
                    <button type="button" onClick={() => handleRename(board.id)}>
                      Save
                    </button>
                    <button type="button" onClick={() => setRenamingId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <Link to={`/boards/${board.id}`} className="board-list-link">
                      {board.name}
                      <span className="board-role">{board.role}</span>
                    </Link>
                    {board.role === "owner" && (
                      <div className="board-list-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(board.id);
                            setRenameValue(board.name);
                          }}
                        >
                          Rename
                        </button>
                        <button type="button" onClick={() => handleDelete(board.id)}>
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
    </div>
  );
}
