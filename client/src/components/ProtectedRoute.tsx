import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Loading…</div>;
  // Preserve the destination so login/signup can send the user back where
  // they were headed instead of always landing on /boards.
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
}
