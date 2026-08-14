import bcrypt from "bcryptjs";
import { signToken } from "../../middleware/auth.js";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../errors.js";
import {
  findUserByEmail,
  findUserById,
  findUserByUsername,
  insertUser,
} from "./auth.repository.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9]{3,20}$/;

export interface AuthResult {
  id: number;
  email: string;
  username: string;
  token: string;
}

export interface Profile {
  id: number;
  email: string;
  username: string;
}

function validateEmail(email: unknown): string {
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    throw new ValidationError("A valid email address is required");
  }
  return email.toLowerCase();
}

function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }
  return password;
}

function validateUsername(username: unknown): string {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    throw new ValidationError(
      "Username must be 3-20 letters or numbers, no spaces or symbols",
    );
  }
  return username;
}

export async function signup(
  rawEmail: unknown,
  rawPassword: unknown,
  rawUsername: unknown,
): Promise<AuthResult> {
  const email = validateEmail(rawEmail);
  const password = validatePassword(rawPassword);
  const username = validateUsername(rawUsername);

  if (findUserByEmail(email)) {
    throw new ConflictError("An account with this email already exists");
  }
  if (findUserByUsername(username)) {
    throw new ConflictError("That username is already taken");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = insertUser(email, passwordHash, username);
  const token = signToken({ userId: id, username });

  return { id, email, username, token };
}

export async function login(
  rawUsername: unknown,
  rawPassword: unknown,
): Promise<AuthResult> {
  if (typeof rawUsername !== "string" || typeof rawPassword !== "string") {
    throw new UnauthorizedError("Invalid credentials");
  }

  const user = findUserByUsername(rawUsername);
  if (!user || !(await bcrypt.compare(rawPassword, user.password_hash))) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = signToken({ userId: user.id, username: user.username });
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    token,
  };
}

export function getProfile(userId: number): Profile {
  const user = findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return { id: user.id, email: user.email, username: user.username };
}
