import { useEffect, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../../hooks/useApi";
import type { BoardSummary } from "../../types";

export function useBoardListPage() {
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

  function startRename(board: BoardSummary) {
    setRenamingId(board.id);
    setRenameValue(board.name);
  }

  function cancelRename() {
    setRenamingId(null);
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

  return {
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
    handleDelete,
  };
}
