import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <Link to="/boards" className="app-header-brand">
        Collab Whiteboard
      </Link>
      {user && (
        <div className="app-header-user">
          <span>{user.username}</span>
          <button type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
