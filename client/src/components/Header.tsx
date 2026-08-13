import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { BrandIcon } from "./icons";
import { Avatar } from "./Avatar";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <Link to="/boards" className="app-header-brand">
        <BrandIcon />
        Collab Whiteboard
      </Link>
      {user && (
        <div className="app-header-user">
          <Avatar name={user.displayName} userId={user.id} color="var(--accent)" />
          <span>{user.displayName}</span>
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
