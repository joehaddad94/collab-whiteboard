-- Schema for the collab-whiteboard server (ADR-006, ADR-009, ADR-020).
-- Executed idempotently at startup by db/index.ts — see ADR-012.
-- Foreign key enforcement (PRAGMA foreign_keys = ON) is set by the connection code,
-- not here, since pragmas are a per-connection setting in SQLite.

CREATE TABLE IF NOT EXISTS User (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Board (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES User(id),
  data TEXT NOT NULL DEFAULT '[]',
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Join table for board access control (ADR-009): who can open which board.
CREATE TABLE IF NOT EXISTS BoardMember (
  board_id INTEGER NOT NULL REFERENCES Board(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_boardmember_user_id ON BoardMember(user_id);

-- Chat history (ADR-020) — normalized, unlike Board.data, since messages are
-- discrete append-only records rather than one mutable canvas state.
CREATE TABLE IF NOT EXISTS ChatMessage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES Board(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chatmessage_board_id ON ChatMessage(board_id, created_at);
