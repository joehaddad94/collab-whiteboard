import { useEffect } from "react";

interface UseConfirmDialogOptions {
  onCancel: () => void;
}

export function useConfirmDialog({ onCancel }: UseConfirmDialogOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);
}
