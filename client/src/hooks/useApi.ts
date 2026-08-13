import type {
  ApiError,
  BoardDetail,
  BoardSummary,
  Stroke,
  User,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

// Set by AuthContext so any 401 from an authenticated call can bounce back to /login.
// Left unset during the initial /auth/me probe, which treats 401 as "not logged in" rather
// than an error.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  opts: { suppressUnauthorizedRedirect?: boolean } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && !opts.suppressUnauthorizedRedirect) {
    onUnauthorized?.();
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiError;
      if (body.error) message = body.error;
    } catch {
      // no JSON body — keep statusText
    }
    throw new ApiRequestError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  auth: {
    signup: (username: string, password: string) =>
      request<User>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    login: (username: string, password: string) =>
      request<User>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    logout: () => request<void>("/api/auth/logout", { method: "POST" }),
    me: () =>
      request<User>(
        "/api/auth/me",
        {},
        { suppressUnauthorizedRedirect: true },
      ),
  },
  boards: {
    list: () => request<BoardSummary[]>("/api/boards"),
    create: (name: string) =>
      request<BoardDetail>("/api/boards", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    get: (id: number) => request<BoardDetail>(`/api/boards/${id}`),
    rename: (id: number, name: string) =>
      request<BoardDetail>(`/api/boards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    remove: (id: number) =>
      request<void>(`/api/boards/${id}`, { method: "DELETE" }),
    saveData: (id: number, data: Stroke[]) =>
      request<{ id: number; data: Stroke[] }>(`/api/boards/${id}/data`, {
        method: "PUT",
        body: JSON.stringify({ data }),
      }),
  },
};

export { ApiRequestError };
