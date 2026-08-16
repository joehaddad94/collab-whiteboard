import { useEffect } from "react";

interface UseDialogDismissOptions {
  onDismiss: () => void;
}

// Escape-to-close, shared by every dialog so they don't each grow their own
// copy that drifts. Was useConfirmDialog, which described where it happened to
// be used rather than what it does.
export function useDialogDismiss({ onDismiss }: UseDialogDismissOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);
}
