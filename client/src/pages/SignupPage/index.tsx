import { Link } from "react-router-dom";
import { BrandIcon } from "../../components/icons";
import { useSignupPage } from "./useSignupPage";

export function SignupPage() {
  const {
    email,
    setEmail,
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    handleSubmit,
  } = useSignupPage();

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <Link to="/login" className="app-header-brand">
          <BrandIcon size={22} />
          Collab Whiteboard
        </Link>
        <h1>Sign up</h1>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Username
          <input
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
            autoComplete="new-password"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Signing up…" : "Sign up"}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
