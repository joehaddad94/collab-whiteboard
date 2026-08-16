import { useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "../icons";
import { useDialog } from "./useDialog";

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** Rendered in the dialog's footer. Omit for dialogs with no action row. */
  actions?: ReactNode;
  /** A close button in the header is right for a dialog you dismiss, wrong for
      one that asks a question and expects an answer from its action row. */
  showCloseButton?: boolean;
  className?: string;
}

// The shell every dialog shares: the backdrop, the escape/overlay-click
// dismissal, and the labelled role="dialog" wiring. Extracted so a second
// dialog doesn't mean a second copy of all of it - the parts that were easy
// to get subtly different are exactly the accessibility ones.
export function Dialog({
  title,
  children,
  onClose,
  actions,
  showCloseButton = false,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialog({ onClose, dialogRef });
  // Generated, not hardcoded: two dialogs open at once would otherwise both
  // claim the same id and aria-labelledby would resolve to the wrong one.
  const titleId = useId();

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        // Focusable so the dialog itself can hold focus when it has no
        // focusable children yet.
        tabIndex={-1}
        className={`dialog ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h3 id={titleId}>{title}</h3>
          {showCloseButton && (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {children}

        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}
