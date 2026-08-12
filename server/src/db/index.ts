import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Callers must load environment variables (dotenv) before importing this module,
// since DB_FILE is read at import time — see src/index.ts (ADR-014).
const dbFile = process.env.DB_FILE ?? "./data/whiteboard.sqlite";

const dbDir = dirname(dbFile);
if (dbDir && dbDir !== "." && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(dbFile);

// Per-connection setting in SQLite — must be set here, not in schema.sql.
db.exec("PRAGMA foreign_keys = ON;");

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);
