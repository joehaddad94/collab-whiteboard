import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import {
  signToken,
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

const router = Router();

// maxAge matches the JWT's own 7-day expiry (ADR-015) — no point keeping the
// cookie around longer than the token inside it is valid.
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const USERNAME_RE = /^[a-zA-Z0-9]{3,20}$/;

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

router.post("/signup", (req, res: Response) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    res
      .status(400)
      .json({ error: "Username must be 3-20 alphanumeric characters" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM User WHERE username = ?")
    .get(username);
  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO User (username, password_hash) VALUES (?, ?)")
    .run(username, passwordHash);

  const userId = Number(result.lastInsertRowid);
  const token = signToken({ userId, username });
  res.cookie("token", token, COOKIE_OPTIONS);
  res.status(201).json({ id: userId, username });
});

router.post("/login", (req, res: Response) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const user = db
    .prepare("SELECT id, username, password_hash FROM User WHERE username = ?")
    .get(username) as UserRow | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username });
  res.cookie("token", token, COOKIE_OPTIONS);
  res.json({ id: user.id, username: user.username });
});

router.post("/logout", (_req, res: Response) => {
  res.clearCookie("token", COOKIE_OPTIONS);
  res.status(204).send();
});

router.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ id: req.user!.userId, username: req.user!.username });
});

export default router;
