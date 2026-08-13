import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBoardSocket } from "../../hooks/useBoardSocket";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiRequestError } from "../../hooks/useApi";
import type { BoardDetail, Tool } from "../../types";

const DEFAULT_COLOR = "#1b1d22";
const DEFAULT_BRUSH_SIZE = 4;

export function useBoardPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);

  const { connected, connectedUsers, leaveReason, socketError, clearSocketError } =
    useBoardSocket(boardId);

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
    if (leaveReason) navigate("/boards");
  }, [leaveReason, navigate]);

  return {
    board,
    loadError,
    connected,
    connectedUsers,
    socketError,
    clearSocketError,
    userId: user?.id ?? null,
    goBack: () => navigate("/boards"),
    tool,
    setTool,
    color,
    setColor,
    brushSize,
    setBrushSize,
  };
}
