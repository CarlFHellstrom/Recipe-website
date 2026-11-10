import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'recipes.db');
const schemaPath = path.join(__dirname, 'db', 'schema.sql');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(dbPath);

updateDatabase();
db.pragma('foreign_keys = ON');

export default db;

/*
  Brings the database up to date with db/schema.sql.

  schema.sql is split into blocks that start with "-- @version N".
  SQLite stores a number in the database file called user_version; we use it
  to remember the highest block that has run. Every block with a higher
  number runs now, in order, each inside a transaction (so a block that
  fails changes nothing).
*/
function updateDatabase() {
  const blocks = readSchemaBlocks();
  const latest = blocks.at(-1)?.version ?? 0;
  let current = db.pragma('user_version', { simple: true });

  // A database with tables but no version was made before versioning existed
  const tableCount = db
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get().n;
  if (current === 0 && tableCount > 0) {
    fail('was created by an older version of the app and can\'t be upgraded');
  }
  if (current > latest) {
    fail(`is at version ${current}, but schema.sql only goes up to version ${latest}`);
  }

  // Foreign keys must be off while tables are changed
  // (this setting can't be changed inside a transaction).
  db.pragma('foreign_keys = OFF');

  for (const block of blocks) {
    if (block.version <= current) continue;

    db.transaction(() => {
      db.exec(block.sql);

      // Make sure the change didn't leave broken references behind
      const problems = db.pragma('foreign_key_check');
      if (problems.length > 0) {
        throw new Error(
          `schema.sql version ${block.version} broke foreign keys: ${JSON.stringify(problems)}`
        );
      }

      db.pragma(`user_version = ${block.version}`);
    })();

    console.log(`Database updated to version ${block.version}`);
    current = block.version;
  }
}

// Splits schema.sql into [{ version, sql }], checking the numbers go up.
function readSchemaBlocks() {
  const text = fs.readFileSync(schemaPath, 'utf8');
  const marker = /^--\s*@version\s+(\d+)\s*$/gm;

  const starts = [...text.matchAll(marker)];
  const blocks = starts.map((match, i) => ({
    version: Number(match[1]),
    sql: text.slice(match.index + match[0].length, starts[i + 1]?.index ?? text.length),
  }));

  blocks.forEach((block, i) => {
    if (i > 0 && block.version <= blocks[i - 1].version) {
      throw new Error(
        `schema.sql: version ${block.version} comes after version ${blocks[i - 1].version}; ` +
          'versions must go up'
      );
    }
  });

  return blocks;
}

function fail(reason) {
  db.close();
  throw new Error(
    `The database at ${dbPath} ${reason}.\n` +
      'Delete that file and restart the server; it will be recreated.'
  );
}