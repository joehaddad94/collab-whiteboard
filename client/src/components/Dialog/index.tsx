import { useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "../icons";
import { useDialog } from "./useDialog";

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  showCloseButton?: boolean;
  className?: string;
}

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
  const titleId = useId();

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
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
