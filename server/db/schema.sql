-- =============================================================================
-- Recipe website database
--
-- This file is split into numbered blocks, each starting with a line like
--     -- @version 3
-- The database remembers the highest version it has run. On startup the
-- server runs every block with a higher number, in order, so:
--   * a brand-new database runs all blocks
--   * an existing database only runs the new ones
--
-- To change the database: add a NEW block at the bottom with the next number.
-- Never edit a block that has already run on your database: it won't run again.
--
-- (The numbering starts at 2 because version 1 was an earlier layout.)
-- =============================================================================


-- @version 2

-- Allowed measurement units (the dropdowns are filled from this table).
-- A recipe line with no unit is a counted item, e.g. "2 onions".
CREATE TABLE units (
  unit   TEXT PRIMARY KEY,
  plural TEXT NOT NULL            -- same as unit for abbreviations, e.g. 'g' -> 'g'
);

INSERT INTO units (unit, plural) VALUES
  ('g', 'g'), ('kg', 'kg'), ('ml', 'ml'), ('dl', 'dl'), ('l', 'l'),
  ('tsp', 'tsp'), ('tbsp', 'tbsp'), ('cup', 'cups'), ('pinch', 'pinches'),
  ('clove', 'cloves'), ('can', 'cans'), ('slice', 'slices'), ('piece', 'pieces'),
  ('stick', 'sticks'), ('bunch', 'bunches'), ('sprig', 'sprigs'), ('head', 'heads'),
  ('fillet', 'fillets'), ('lb', 'lbs'), ('oz', 'oz');

-- Just the ingredient itself. The unit is chosen per recipe line,
-- so "Flour" can be 2 cups in one recipe and 200 g in another.
CREATE TABLE ingredients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  plural_name TEXT                                   -- optional, e.g. 'Onions'
);

-- A recipe. The name is unique (case-insensitive), but rows are linked by id
-- so a recipe can be renamed without touching the other tables.
CREATE TABLE recipes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description  TEXT,                                 -- optional
  yield_amount REAL CHECK (yield_amount > 0),        -- optional, e.g. 4 or 12
  yield_unit   TEXT,                                 -- optional, e.g. 'servings' or 'pancakes'
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One ingredient line in a recipe, e.g. "1–2 red onions (large)" or "3 cloves garlic".
-- The same ingredient may appear twice (e.g. butter in the batter and butter for frying).
CREATE TABLE recipe_ingredients (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  amount        REAL    NOT NULL CHECK (amount > 0),
  max_amount    REAL,                                -- optional, "1-2" => amount 1, max_amount 2
  unit          TEXT    REFERENCES units(unit),      -- NULL = counted item, e.g. "2 onions"
  optional      INTEGER NOT NULL DEFAULT 0 CHECK (optional IN (0, 1)),  -- 0 = no, 1 = yes
  note          TEXT,                                -- optional, e.g. 'large', 'chopped'
  position      INTEGER NOT NULL,                    -- display order in the list
  UNIQUE (recipe_id, position),
  CHECK (max_amount > amount)                        -- passes when max_amount is NULL
);

-- The steps of a recipe, in order.
CREATE TABLE steps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL CHECK (step_number >= 1),
  instruction TEXT    NOT NULL,
  UNIQUE (recipe_id, step_number)                    -- no two "step 2"s in one recipe
);


-- Example of a future change (remove the leading "-- " from both lines to use it):
-- -- @version 3
-- ALTER TABLE recipes ADD COLUMN cook_minutes INTEGER;