import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ApiRequestError } from "../../hooks/useApi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9]{3,20}$/;

export function useSignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/boards";
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      setError("Username must be 3-20 letters or numbers, no spaces or symbols.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await signup(email, password, username);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    email,
    setEmail,
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    handleSubmit,
  };
}
