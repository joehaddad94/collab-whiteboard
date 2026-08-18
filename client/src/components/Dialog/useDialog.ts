import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface UseDialogOptions {
  onClose: () => void;
  dialogRef: RefObject<HTMLDivElement | null>;
}

// What a dialog claiming aria-modal="true" actually has to do: take focus on
// open, keep Tab inside, hand focus back on close, stop the page behind it
// scrolling, and close on Escape. Claiming aria-modal without these tells
// assistive tech the rest of the page is inert while leaving it reachable.
export function useDialog({ onClose, dialogRef }: UseDialogOptions) {
  useEffect(() => {
    const node = dialogRef.current;
    // Captured before focus moves, so it can be handed back on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Queried on demand rather than once: the dialog's contents change as
    // rows swap between Remove and Confirm/Cancel.
    const focusable = () =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    (focusable()[0] ?? node)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;

      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and treat the panel itself as "before the first"
      // so shift-tabbing straight after opening doesn't escape backwards.
      if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose, dialogRef]);
}
