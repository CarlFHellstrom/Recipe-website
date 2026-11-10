-- Allowed measurement units (the dropdown will be filled from this table)
CREATE TABLE IF NOT EXISTS units (
  name TEXT PRIMARY KEY
);

INSERT OR IGNORE INTO units (name) VALUES
  ('g'), ('kg'), ('ml'), ('dl'), ('l'),
  ('tsp'), ('tbsp'), ('cup'), ('pcs');

CREATE TABLE IF NOT EXISTS ingredients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  unit       TEXT NOT NULL REFERENCES units(name),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);