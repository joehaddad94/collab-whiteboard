import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Loading…</div>;
  // Preserve the destination (e.g. /join/:code) so login/signup can send the
  // user back where they were headed - an invite link is the main case this
  // matters for, since the recipient often isn't logged in yet.
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
}
