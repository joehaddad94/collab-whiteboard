import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiRequestError } from "../../hooks/useApi";

export function useJoinBoardPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("Invalid invite link.");
      return;
    }

    let cancelled = false;
    api.boards
      .joinByCode(code)
      .then(({ boardId }) => {
        if (!cancelled) navigate(`/boards/${boardId}`, { replace: true });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError ? err.message : "Failed to join board",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return { error };
}
