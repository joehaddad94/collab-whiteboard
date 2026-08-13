import type {
  ApiError,
  BoardDetail,
  BoardMember,
  BoardSummary,
  Stroke,
  User,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

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
    }
    throw new ApiRequestError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  auth: {
    signup: (email: string, password: string, displayName: string) =>
      request<User>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      }),
    login: (email: string, password: string) =>
      request<User>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
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
    listMembers: (id: number) => request<BoardMember[]>(`/api/boards/${id}/members`),
    inviteMember: (id: number, email: string) =>
      request<{ userId: number; displayName: string; role: BoardMember["role"] }>(
        `/api/boards/${id}/members`,
        { method: "POST", body: JSON.stringify({ email }) },
      ),
    regenerateInviteLink: (id: number) =>
      request<{ inviteCode: string }>(`/api/boards/${id}/invite-link/regenerate`, {
        method: "POST",
      }),
    joinByCode: (code: string) =>
      request<{ boardId: number; role: BoardMember["role"] }>(
        `/api/boards/join/${code}`,
        { method: "POST" },
      ),
  },
};

export { ApiRequestError };
