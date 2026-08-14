import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, setUnauthorizedHandler } from "./useApi";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    username: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    api.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const loggedInUser = await api.auth.login(username, password);
    setUser(loggedInUser);
  }

  async function signup(
    email: string,
    password: string,
    username: string,
  ) {
    const newUser = await api.auth.signup(email, password, username);
    setUser(newUser);
  }

  async function logout() {
    await api.auth.logout();
    setUser(null);
    navigate("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
