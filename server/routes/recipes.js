import express from 'express';
import db from '../db.js';
import { HttpError } from '../httpError.js';

const router = express.Router();

// List all recipes (summary only)
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.name, r.description, r.yield_amount, r.yield_unit,
              r.created_at, r.updated_at,
              (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ingredient_count,
              (SELECT COUNT(*) FROM steps s WHERE s.recipe_id = r.id) AS step_count
       FROM recipes r
       ORDER BY r.name`
    )
    .all();
  res.json(rows);
});

// Get one recipe with its ingredients and steps
router.get('/:id', (req, res) => {
  res.json(getRecipe(req.params.id));
});

function getRecipe(id) {
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  if (!recipe) throw new HttpError(404, 'Recipe not found');

  recipe.ingredients = db
    .prepare(
      `SELECT ri.ingredient_id, i.name, i.plural_name,
              ri.amount, ri.max_amount, ri.unit, u.plural AS unit_plural,
              ri.optional, ri.note
       FROM recipe_ingredients ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       LEFT JOIN units u ON u.unit = ri.unit
       WHERE ri.recipe_id = ?
       ORDER BY ri.position`
    )
    .all(id)
    .map((row) => ({ ...row, optional: row.optional === 1 }));

  recipe.steps = db
    .prepare(
      `SELECT step_number, instruction
       FROM steps
       WHERE recipe_id = ?
       ORDER BY step_number`
    )
    .all(id);

  return recipe;
}

/*
  Create a recipe. Expected body (PUT /:id uses the same shape):
  {
    "name": "Pancakes",
    "description": "Optional text",
    "yieldAmount": 12,              // optional
    "yieldUnit": "pancakes",        // optional (defaults to "servings" if only an amount is given)
    "ingredients": [
      { "ingredientId": 1, "amount": 200, "unit": "g" },                   // existing ingredient
      { "name": "Oat milk", "amount": 5, "unit": "dl" },                   // new ingredient
      { "ingredientId": 3, "amount": 1, "unit": "tbsp",
        "optional": true, "note": "for frying" },
      { "name": "Red onion", "pluralName": "Red onions",                    // counted, no unit:
        "amount": 1, "maxAmount": 2, "unit": null }                         // "1-2 red onions"
    ],
    "steps": ["Mix everything", "Fry in a pan"]                            // in order
  }
*/
router.post('/', (req, res) => {
  const recipe = validateRecipe(req.body);

  const create = db.transaction(() => {
    let recipeId;
    try {
      recipeId = db
        .prepare(
          'INSERT INTO recipes (name, description, yield_amount, yield_unit) VALUES (?, ?, ?, ?)'
        )
        .run(recipe.name, recipe.description, recipe.yieldAmount, recipe.yieldUnit)
        .lastInsertRowid;
    } catch (err) {
      throw nameTakenError(err, recipe.name);
    }
    saveLinesAndSteps(recipeId, recipe);
    return recipeId;
  });

  const recipeId = create();
  res.status(201).json(getRecipe(recipeId));
});

// Update a recipe: replaces its fields, ingredient lines and steps
router.put('/:id', (req, res) => {
  const recipe = validateRecipe(req.body);
  const id = req.params.id;

  const update = db.transaction(() => {
    let result;
    try {
      result = db
        .prepare(
          `UPDATE recipes
           SET name = ?, description = ?, yield_amount = ?, yield_unit = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .run(recipe.name, recipe.description, recipe.yieldAmount, recipe.yieldUnit, id);
    } catch (err) {
      throw nameTakenError(err, recipe.name);
    }
    if (result.changes === 0) throw new HttpError(404, 'Recipe not found');

    // Simplest correct approach: remove the old lines/steps and insert the new ones.
    db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
    db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(id);
    saveLinesAndSteps(id, recipe);
  });

  update();
  res.json(getRecipe(id));
});

// Delete a recipe (its ingredient lines and steps are removed automatically)
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw new HttpError(404, 'Recipe not found');
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cleanText = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

// Checks the request body and returns a cleaned-up recipe object.
function validateRecipe(body = {}) {
  const name = cleanText(body.name);
  if (!name) throw new HttpError(400, 'Recipe name is required');

  // "Makes 12 pancakes" / "Serves 4" (both optional)
  let yieldAmount = null;
  if (body.yieldAmount !== undefined && body.yieldAmount !== null && body.yieldAmount !== '') {
    yieldAmount = Number(body.yieldAmount);
    if (!Number.isFinite(yieldAmount) || yieldAmount <= 0) {
      throw new HttpError(400, '"Makes" must be a number above 0');
    }
  }
  let yieldUnit = cleanText(body.yieldUnit);
  if (yieldUnit && yieldAmount === null) {
    throw new HttpError(400, `Enter how many ${yieldUnit} the recipe makes`);
  }
  if (yieldAmount !== null && !yieldUnit) yieldUnit = 'servings';

  const steps = Array.isArray(body.steps)
    ? body.steps.map(cleanText).filter(Boolean)
    : [];
  if (steps.length === 0) throw new HttpError(400, 'At least one step is required');

  const items = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (items.length === 0) throw new HttpError(400, 'At least one ingredient is required');

  const lines = items.map((item, i) => {
    const label = `Ingredient ${i + 1}`;

    const amount = Number(item?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, `${label}: amount must be a number above 0`);
    }

    let maxAmount = null;
    if (item.maxAmount !== undefined && item.maxAmount !== null && item.maxAmount !== '') {
      maxAmount = Number(item.maxAmount);
      if (!Number.isFinite(maxAmount) || maxAmount <= amount) {
        throw new HttpError(400, `${label}: the "to" amount must be bigger than ${amount}`);
      }
    }

    // null / '' = no unit (a counted item like "2 onions")
    const unit = item.unit ? item.unit : null;
    if (unit !== null) {
      const unitExists = db.prepare('SELECT 1 FROM units WHERE unit = ?').get(unit);
      if (!unitExists) throw new HttpError(400, `${label}: unknown unit "${unit}"`);
    }

    const ingredientId = item.ingredientId ?? null;
    const newName = ingredientId === null ? cleanText(item.name) : null;
    if (ingredientId === null && !newName) {
      throw new HttpError(400, `${label}: pick an ingredient or enter a name`);
    }

    return {
      ingredientId,
      newName,
      newPluralName: ingredientId === null ? cleanText(item.pluralName) : null,
      amount,
      maxAmount,
      unit,
      optional: item.optional ? 1 : 0,
      note: cleanText(item.note),
    };
  });

  return {
    name,
    description: cleanText(body.description),
    yieldAmount,
    yieldUnit,
    lines,
    steps,
  };
}

// Inserts the ingredient lines and steps for a recipe.
// Must be called inside a transaction.
function saveLinesAndSteps(recipeId, recipe) {
  const insertLine = db.prepare(
    `INSERT INTO recipe_ingredients
       (recipe_id, ingredient_id, amount, max_amount, unit, optional, note, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  recipe.lines.forEach((line, i) => {
    const ingredientId = resolveIngredient(line, i + 1);
    insertLine.run(
      recipeId, ingredientId, line.amount, line.maxAmount,
      line.unit, line.optional, line.note, i + 1
    );
  });

  const insertStep = db.prepare(
    'INSERT INTO steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)'
  );
  recipe.steps.forEach((text, i) => insertStep.run(recipeId, i + 1, text));
}

// Turns an ingredient line into an ingredient id, creating the ingredient if it is new.
function resolveIngredient(line, lineNumber) {
  if (line.ingredientId !== null) {
    const found = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(line.ingredientId);
    if (!found) throw new HttpError(400, `Ingredient ${lineNumber}: not found`);
    return found.id;
  }

  // New name: reuse it if it already exists (e.g. two new "Butter" lines), otherwise create it
  const existing = db
    .prepare('SELECT id, plural_name FROM ingredients WHERE name = ?')
    .get(line.newName);
  if (existing) {
    if (!existing.plural_name && line.newPluralName) {
      db.prepare('UPDATE ingredients SET plural_name = ? WHERE id = ?')
        .run(line.newPluralName, existing.id);
    }
    return existing.id;
  }

  return db
    .prepare('INSERT INTO ingredients (name, plural_name) VALUES (?, ?)')
    .run(line.newName, line.newPluralName).lastInsertRowid;
}

function nameTakenError(err, name) {
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new HttpError(409, `A recipe called "${name}" already exists`);
  }
  return err;
}

export default router;
