CREATE TABLE IF NOT EXISTS User (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username_nocase ON User(username COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS Board (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES User(id),
  data TEXT NOT NULL DEFAULT '[]',
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS BoardMember (
  board_id INTEGER NOT NULL REFERENCES Board(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_boardmember_user_id ON BoardMember(user_id);

CREATE TABLE IF NOT EXISTS ChatMessage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES Board(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chatmessage_board_id ON ChatMessage(board_id, created_at);
