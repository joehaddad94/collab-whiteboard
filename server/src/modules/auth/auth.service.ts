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
  insertUser,
} from "./auth.repository.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_MAX_LENGTH = 50;

export interface AuthResult {
  id: number;
  email: string;
  displayName: string;
  token: string;
}

export interface Profile {
  id: number;
  email: string;
  displayName: string;
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

function validateDisplayName(displayName: unknown): string {
  if (typeof displayName !== "string") {
    throw new ValidationError("Display name is required");
  }
  const trimmed = displayName.trim();
  if (trimmed.length === 0 || trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new ValidationError(
      `Display name must be 1-${DISPLAY_NAME_MAX_LENGTH} characters`,
    );
  }
  return trimmed;
}

export function signup(
  rawEmail: unknown,
  rawPassword: unknown,
  rawDisplayName: unknown,
): AuthResult {
  const email = validateEmail(rawEmail);
  const password = validatePassword(rawPassword);
  const displayName = validateDisplayName(rawDisplayName);

  if (findUserByEmail(email)) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const id = insertUser(email, passwordHash, displayName);
  const token = signToken({ userId: id, displayName });

  return { id, email, displayName, token };
}

export function login(rawEmail: unknown, rawPassword: unknown): AuthResult {
  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
    throw new UnauthorizedError("Invalid credentials");
  }

  const user = findUserByEmail(rawEmail.toLowerCase());
  if (!user || !bcrypt.compareSync(rawPassword, user.password_hash)) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = signToken({ userId: user.id, displayName: user.display_name });
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    token,
  };
}

export function getProfile(userId: number): Profile {
  const user = findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return { id: user.id, email: user.email, displayName: user.display_name };
}
