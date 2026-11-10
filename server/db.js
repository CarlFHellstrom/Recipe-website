import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(path.join(__dirname, 'data', 'recipes.db'));
db.pragma("foreign_keys = ON");

const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
db.exec(schema);

export default db;