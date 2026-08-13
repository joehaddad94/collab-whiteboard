import { db } from "../../db/index.js";

export interface UserRow {
  id: number;
  email: string;
  display_name: string;
  password_hash: string;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db
    .prepare(
      "SELECT id, email, display_name, password_hash FROM User WHERE email = ?",
    )
    .get(email) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
  return db
    .prepare(
      "SELECT id, email, display_name, password_hash FROM User WHERE id = ?",
    )
    .get(id) as UserRow | undefined;
}

export function insertUser(
  email: string,
  passwordHash: string,
  displayName: string,
): number {
  const result = db
    .prepare(
      "INSERT INTO User (email, password_hash, display_name) VALUES (?, ?, ?)",
    )
    .run(email, passwordHash, displayName);
  return Number(result.lastInsertRowid);
}
