import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import * as authService from "./auth.service.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function signup(req: AuthenticatedRequest, res: Response) {
  const result = await authService.signup(
    req.body?.email,
    req.body?.password,
    req.body?.username,
  );
  res.cookie("token", result.token, COOKIE_OPTIONS);
  res
    .status(201)
    .json({ id: result.id, email: result.email, username: result.username });
}

export async function login(req: AuthenticatedRequest, res: Response) {
  const result = await authService.login(req.body?.identifier, req.body?.password);
  res.cookie("token", result.token, COOKIE_OPTIONS);
  res.json({ id: result.id, email: result.email, username: result.username });
}

export function logout(_req: AuthenticatedRequest, res: Response) {
  res.clearCookie("token", COOKIE_OPTIONS);
  res.status(204).send();
}

export function me(req: AuthenticatedRequest, res: Response) {
  res.json(authService.getProfile(req.user!.userId));
}
