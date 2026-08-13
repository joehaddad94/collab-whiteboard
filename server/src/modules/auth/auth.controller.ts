import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import * as authService from "./auth.service.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function signup(req: AuthenticatedRequest, res: Response) {
  const result = authService.signup(req.body?.username, req.body?.password);
  res.cookie("token", result.token, COOKIE_OPTIONS);
  res.status(201).json({ id: result.id, username: result.username });
}

export function login(req: AuthenticatedRequest, res: Response) {
  const result = authService.login(req.body?.username, req.body?.password);
  res.cookie("token", result.token, COOKIE_OPTIONS);
  res.json({ id: result.id, username: result.username });
}

export function logout(_req: AuthenticatedRequest, res: Response) {
  res.clearCookie("token", COOKIE_OPTIONS);
  res.status(204).send();
}

export function me(req: AuthenticatedRequest, res: Response) {
  res.json({ id: req.user!.userId, username: req.user!.username });
}
