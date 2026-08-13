import { Link } from "react-router-dom";
import { useJoinBoardPage } from "./useJoinBoardPage";

export function JoinBoardPage() {
  const { error } = useJoinBoardPage();

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h1>Couldn't join board</h1>
          <p className="form-error">{error}</p>
          <Link to="/boards" className="btn btn-primary">
            Back to boards
          </Link>
        </div>
      </div>
    );
  }

  return <div className="page-loading">Joining board…</div>;
}
