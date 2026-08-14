import { Link } from "react-router-dom";
import { BrandIcon } from "../../components/icons";
import { useLoginPage } from "./useLoginPage";

export function LoginPage() {
  const {
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    handleSubmit,
  } = useLoginPage();

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <Link to="/login" className="app-header-brand">
          <BrandIcon size={22} />
          Collab Whiteboard
        </Link>
        <h1>Log in</h1>
        {error && <p className="form-error">{error}</p>}
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
