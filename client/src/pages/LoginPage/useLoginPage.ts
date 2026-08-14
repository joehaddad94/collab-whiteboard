import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ApiRequestError } from "../../hooks/useApi";

export function useLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/boards";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    handleSubmit,
  };
}
