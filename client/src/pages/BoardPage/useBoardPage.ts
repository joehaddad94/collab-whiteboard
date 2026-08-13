import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBoardSocket } from "../../hooks/useBoardSocket";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiRequestError } from "../../hooks/useApi";
import type { BoardDetail, BoardMember, Stroke, Tool } from "../../types";

const DEFAULT_COLOR = "#1b1d22";
const DEFAULT_BRUSH_SIZE = 4;

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

  const boardStrokesRef = useRef<Stroke[]>([]);
  const hasHydratedRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const {
    socket,
    connected,
    connectedUsers,
    cursors,
    messages,
    sendMessage,
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

  function handleStrokesChange(strokes: Stroke[]) {
    boardStrokesRef.current = strokes;
    // The first strokes-change per board is the initial board-joined hydrate,
    // not a real edit - only mark unsaved for changes after that.
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    setSaveStatus("unsaved");
  }

  async function save() {
    if (!Number.isInteger(boardId)) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await api.boards.saveData(boardId, boardStrokesRef.current);
      setSaveStatus("saved");
    } catch (err) {
      setSaveStatus("unsaved");
      setSaveError(err instanceof ApiRequestError ? err.message : "Failed to save");
    }
  }

  function undo() {
    socket?.emit("undo");
  }

  function redo() {
    socket?.emit("redo");
  }

  function clearBoard() {
    if (!confirm("Clear the whole board? This can't be undone.")) return;
    socket?.emit("clear-board");
  }

  function updateInviteCode(code: string) {
    setBoard((prev) => (prev ? { ...prev, inviteCode: code } : prev));
  }

  const roleByUserId = new Map(members.map((m) => [m.userId, m.role]));
  const onlineMembers = connectedUsers.map((u) => ({
    ...u,
    role: roleByUserId.get(u.userId),
  }));

  return {
    board,
    loadError,
    socket,
    connected,
    connectedUsers,
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
    clearBoard,
    showInvitePanel,
    setShowInvitePanel,
    updateInviteCode,
    showChat,
    setShowChat,
  };
}
