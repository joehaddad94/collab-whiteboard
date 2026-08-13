import { db } from "../../db/index.js";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db
    .prepare("SELECT id, username, password_hash FROM User WHERE username = ?")
    .get(username) as UserRow | undefined;
}

export function insertUser(username: string, passwordHash: string): number {
  const result = db
    .prepare("INSERT INTO User (username, password_hash) VALUES (?, ?)")
    .run(username, passwordHash);
  return Number(result.lastInsertRowid);
}
