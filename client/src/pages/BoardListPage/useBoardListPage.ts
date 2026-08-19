import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadBoards = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const list = await api.boards.list();
      setBoards(list);
      setError(null);
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof ApiRequestError ? err.message : "Failed to load boards",
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (renamingId !== null) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadBoards({ silent: true });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadBoards, renamingId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api.boards.create(name);
      setNewBoardName("");
      await loadBoards();
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
      await loadBoards();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to rename board");
    }
  }

  function requestDelete(id: number) {
    setConfirmDeleteId(id);
  }

  function cancelDelete() {
    setConfirmDeleteId(null);
  }

  async function confirmDelete() {
    if (confirmDeleteId === null) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.boards.remove(id);
      await loadBoards();
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
    confirmDeleteId,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
