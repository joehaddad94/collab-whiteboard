import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBoardSocket } from "../../hooks/useBoardSocket";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiRequestError } from "../../hooks/useApi";
import type { BoardDetail, BoardMember, Tool } from "../../types";

const DEFAULT_COLOR = "#1b1d22";
const DEFAULT_BRUSH_SIZE = 4;

export type SaveStatus = "saved" | "unsaved";

export function useBoardPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);

  const hasHydratedRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const {
    socket,
    connected,
    hasConnected,
    connectedUsers,
    messages,
    sendMessage,
    lastSavedAt,
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

  // Membership changes come over REST, not sockets, so nothing pushes an
  // update - the People dialog calls this after inviting or removing, and the
  // header's role badges read the same list. Failures have to surface: an
  // empty People dialog is a claim that nobody has access, which is never true.
  const refreshMembers = useCallback(async () => {
    if (!Number.isInteger(boardId)) return;
    setMembersLoading(true);
    try {
      setMembers(await api.boards.listMembers(boardId));
      setMembersError(null);
    } catch (err) {
      setMembersError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't load who has access to this board",
      );
    } finally {
      setMembersLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  useEffect(() => {
    if (!leaveReason) return;
    navigate("/boards", {
      replace: true,
      state: {
        notice:
          leaveReason === "removed"
            ? "You were removed from that board."
            : "That board was deleted by its owner.",
      },
    });
  }, [leaveReason, navigate]);

  // Leaving under your own steam isn't an eviction, so it gets its own wording.
  const handleLeftBoard = useCallback(() => {
    navigate("/boards", {
      replace: true,
      state: { notice: "You left that board." },
    });
  }, [navigate]);

  useEffect(() => {
    hasHydratedRef.current = false;
    setSaveStatus("saved");
  }, [boardId]);

  // Whiteboard is memoized, so an unstable onStrokesChange would defeat it on
  // every render - the useCallback isn't optional. The strokes themselves
  // aren't needed; the server holds what gets persisted, so this only has to
  // notice that something changed.
  const handleStrokesChange = useCallback(() => {
    // The first strokes-change per board is the initial board-joined hydrate,
    // not a real edit - only mark unsaved for changes after that.
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    setSaveStatus("unsaved");
  }, []);

  // No Save button - the server writes on its own and reports it here.
  useEffect(() => {
    if (!lastSavedAt) return;
    setSaveStatus("saved");
  }, [lastSavedAt]);

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

  // UserList is memoized - without useMemo this builds a new array every
  // render, including ones unrelated to presence, and defeats it.
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
    showPeople,
    setShowPeople,
    showChat,
    setShowChat,
  };
}
