import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ApiRequestError } from "../../hooks/useApi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useSignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
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
    if (displayName.trim().length === 0) {
      setError("Display name is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await signup(email, password, displayName.trim());
      navigate("/boards");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    email,
    setEmail,
    displayName,
    setDisplayName,
    password,
    setPassword,
    error,
    submitting,
    handleSubmit,
  };
}
