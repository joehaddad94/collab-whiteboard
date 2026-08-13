import bcrypt from "bcryptjs";
import { signToken } from "../../middleware/auth.js";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "../../errors.js";
import { findUserByUsername, insertUser } from "./auth.repository.js";

const USERNAME_RE = /^[a-zA-Z0-9]{3,20}$/;

export interface AuthResult {
  id: number;
  username: string;
  token: string;
}

function validateUsername(username: unknown): string {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    throw new ValidationError("Username must be 3-20 alphanumeric characters");
  }
  return username;
}

function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }
  return password;
}

export function signup(
  rawUsername: unknown,
  rawPassword: unknown,
): AuthResult {
  const username = validateUsername(rawUsername);
  const password = validatePassword(rawPassword);

  if (findUserByUsername(username)) {
    throw new ConflictError("Username already taken");
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const id = insertUser(username, passwordHash);
  const token = signToken({ userId: id, username });

  return { id, username, token };
}

export function login(rawUsername: unknown, rawPassword: unknown): AuthResult {
  if (typeof rawUsername !== "string" || typeof rawPassword !== "string") {
    throw new UnauthorizedError("Invalid credentials");
  }

  const user = findUserByUsername(rawUsername);
  if (!user || !bcrypt.compareSync(rawPassword, user.password_hash)) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = signToken({ userId: user.id, username: user.username });
  return { id: user.id, username: user.username, token };
}
