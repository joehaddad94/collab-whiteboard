import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBoardSocket } from "../../hooks/useBoardSocket";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiRequestError } from "../../hooks/useApi";
import type { BoardDetail, BoardMember, Tool } from "../../types";

const DEFAULT_COLOR = "#1b1d22";
const DEFAULT_BRUSH_SIZE = 4;
const SAVE_CONFIRM_TIMEOUT_MS = 8000;

export type SaveStatus = "saved" | "unsaved" | "saving";

export function useBoardPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);

  const hasHydratedRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const {
    socket,
    connected,
    connectedUsers,
    messages,
    sendMessage,
    lastSavedAt,
    requestSave,
    leaveReason,
    socketError,
    clearSocketError,
  } = useBoardSocket(boardId);

  useEffect(() => {
    if (!Number.isInteger(boardId)) {
      setLoadError("Invalid board.");
      return;
    }

    let cancelled = false;
    api.boards
      .get(boardId)
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError ? err.message : "Failed to load board",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  useEffect(() => {
    if (!Number.isInteger(boardId)) return;
    let cancelled = false;
    api.boards
      .listMembers(boardId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        // Non-critical: role badges just won't show if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  useEffect(() => {
    if (leaveReason) navigate("/boards");
  }, [leaveReason, navigate]);

  useEffect(() => {
    hasHydratedRef.current = false;
    setSaveStatus("saved");
  }, [boardId]);

  // useCallback here isn't optional cleanup - Whiteboard is memoized, and an
  // unstable onStrokesChange reference would defeat that on every render.
  // The strokes themselves aren't needed: the server holds the copy that gets
  // persisted, so this only has to notice that something changed.
  const handleStrokesChange = useCallback(() => {
    // The first strokes-change per board is the initial board-joined hydrate,
    // not a real edit - only mark unsaved for changes after that.
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    setSaveStatus("unsaved");
  }, []);

  function clearSaveTimeout() {
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }

  // "Saved" is now the server telling us it wrote the board - from an autosave
  // or from the Save button - rather than a local request resolving.
  useEffect(() => {
    if (!lastSavedAt) return;
    clearSaveTimeout();
    setSaveStatus("saved");
    setSaveError(null);
  }, [lastSavedAt]);

  useEffect(() => clearSaveTimeout, []);

  function save() {
    if (!Number.isInteger(boardId)) return;
    setSaveStatus("saving");
    setSaveError(null);
    requestSave();

    // Nothing acknowledges a socket emit, so don't sit on "Saving…" forever if
    // the confirmation never arrives - fall back to unsaved and say so.
    clearSaveTimeout();
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      setSaveStatus("unsaved");
      setSaveError(
        "Couldn't confirm the save. Your drawing is still here, and autosave will retry.",
      );
    }, SAVE_CONFIRM_TIMEOUT_MS);
  }

  // Toolbar is memoized, so these need stable identity too - same reasoning
  // as handleStrokesChange above.
  const undo = useCallback(() => {
    socket?.emit("undo");
  }, [socket]);

  const redo = useCallback(() => {
    socket?.emit("redo");
  }, [socket]);

  const requestClearBoard = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  function confirmClearBoard() {
    setShowClearConfirm(false);
    socket?.emit("clear-board");
  }

  function cancelClearBoard() {
    setShowClearConfirm(false);
  }

  // UserList is memoized - without useMemo this allocates a new array every
  // render (even ones unrelated to presence/membership), which would defeat it.
  const onlineMembers = useMemo(() => {
    const roleByUserId = new Map(members.map((m) => [m.userId, m.role]));
    return connectedUsers.map((u) => ({
      ...u,
      role: roleByUserId.get(u.userId),
    }));
  }, [connectedUsers, members]);

  return {
    board,
    loadError,
    socket,
    connected,
    connectedUsers,
    onlineMembers,
    messages,
    sendMessage,
    socketError,
    clearSocketError,
    saveStatus,
    saveError,
    save,
    handleStrokesChange,
    userId: user?.id ?? null,
    goBack: () => navigate("/boards"),
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
    showInvitePanel,
    setShowInvitePanel,
    showChat,
    setShowChat,
  };
}
