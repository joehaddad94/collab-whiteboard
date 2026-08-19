import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrandIcon } from "./icons";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary-card" role="alert">
          <BrandIcon size={26} />
          <h1>Something went wrong</h1>
          <p>
            The board didn't load properly. Reloading usually clears it — your
            drawing is saved on the server, not in this page.
          </p>

          <div className="error-boundary-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.location.assign("/boards")}
            >
              Back to boards
            </button>
          </div>

          <details className="error-boundary-details">
            <summary>Technical details</summary>
            <code>{this.state.error.message}</code>
          </details>
        </div>
      </div>
    );
  }
}
