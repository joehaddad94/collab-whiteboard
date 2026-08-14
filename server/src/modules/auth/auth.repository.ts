import { db } from "../../db/index.js";

export interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db
    .prepare(
      "SELECT id, email, username, password_hash FROM User WHERE email = ?",
    )
    .get(email) as UserRow | undefined;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db
    .prepare(
      "SELECT id, email, username, password_hash FROM User WHERE username = ? COLLATE NOCASE",
    )
    .get(username) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
  return db
    .prepare(
      "SELECT id, email, username, password_hash FROM User WHERE id = ?",
    )
    .get(id) as UserRow | undefined;
}

export function insertUser(
  email: string,
  passwordHash: string,
  username: string,
): number {
  const result = db
    .prepare(
      "INSERT INTO User (email, password_hash, username) VALUES (?, ?, ?)",
    )
    .run(email, passwordHash, username);
  return Number(result.lastInsertRowid);
}
