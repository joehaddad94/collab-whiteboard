import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBoardSocket } from "../../hooks/useBoardSocket";
import { api, ApiRequestError } from "../../hooks/useApi";
import type { BoardDetail } from "../../types";

export function useBoardPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);
  const navigate = useNavigate();

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    goBack: () => navigate("/boards"),
  };
}
