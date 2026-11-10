import express from 'express';
import db from '../db.js';
import { HttpError } from '../httpError.js';

const router = express.Router();

const cleanText = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

// last_unit: the unit this ingredient was most recently used with in a recipe.
//   NULL = never used, '' = used without a unit (counted, e.g. "2 onions").
// The recipe form uses it to pre-select a unit.
const SELECT_INGREDIENT = `
  SELECT i.id, i.name, i.plural_name, i.created_at,
         (SELECT COUNT(DISTINCT recipe_id) FROM recipe_ingredients ri
           WHERE ri.ingredient_id = i.id) AS recipe_count,
         (SELECT COALESCE(unit, '') FROM recipe_ingredients ri
           WHERE ri.ingredient_id = i.id ORDER BY ri.id DESC LIMIT 1) AS last_unit
  FROM ingredients i`;

// List all ingredients
router.get('/', (req, res) => {
  res.json(db.prepare(`${SELECT_INGREDIENT} ORDER BY i.name`).all());
});

// Add an ingredient: { name, pluralName? }
router.post('/', (req, res) => {
  const { name, pluralName } = validate(req.body);
  try {
    const id = db
      .prepare('INSERT INTO ingredients (name, plural_name) VALUES (?, ?)')
      .run(name, pluralName).lastInsertRowid;
    res.status(201).json(db.prepare(`${SELECT_INGREDIENT} WHERE i.id = ?`).get(id));
  } catch (err) {
    throw nameTakenError(err, name);
  }
});

// Rename an ingredient / change its plural: { name, pluralName? }
router.put('/:id', (req, res) => {
  const { name, pluralName } = validate(req.body);
  let result;
  try {
    result = db
      .prepare('UPDATE ingredients SET name = ?, plural_name = ? WHERE id = ?')
      .run(name, pluralName, req.params.id);
  } catch (err) {
    throw nameTakenError(err, name);
  }
  if (result.changes === 0) throw new HttpError(404, 'Ingredient not found');
  res.json(db.prepare(`${SELECT_INGREDIENT} WHERE i.id = ?`).get(req.params.id));
});

// Delete an ingredient (refused if a recipe uses it)
router.delete('/:id', (req, res) => {
  const usedIn = db
    .prepare(
      `SELECT DISTINCT r.name FROM recipe_ingredients ri
       JOIN recipes r ON r.id = ri.recipe_id
       WHERE ri.ingredient_id = ?
       ORDER BY r.name`
    )
    .all(req.params.id);
  if (usedIn.length > 0) {
    const names = usedIn.map((r) => r.name).join(', ');
    throw new HttpError(409, `Can't delete: this ingredient is used in ${names}`);
  }

  const result = db.prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw new HttpError(404, 'Ingredient not found');
  res.status(204).end();
});

function validate(body = {}) {
  const name = cleanText(body.name);
  if (!name) throw new HttpError(400, 'Name is required');
  return { name, pluralName: cleanText(body.pluralName) };
}

function nameTakenError(err, name) {
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new HttpError(409, `"${name}" already exists`);
  }
  return err;
}

export default router;
