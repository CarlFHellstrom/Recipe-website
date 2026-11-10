import express from 'express';
import db from './db.js';

const app = express();
app.use(express.json());

// List all units (for the dropdown)
app.get('/api/units', (req, res) => {
  const units = db.prepare('SELECT name FROM units ORDER BY rowid').all();
  res.json(units.map((u) => u.name));
});

// List all ingredients
app.get('/api/ingredients', (req, res) => {
  const rows = db.prepare('SELECT * FROM ingredients ORDER BY name').all();
  res.json(rows);
});

// Add an ingredient
app.post('/api/ingredients', (req, res) => {
  const { name, unit } = req.body ?? {};
  const trimmed = typeof name === 'string' ? name.trim() : '';

  if (!trimmed) return res.status(400).json({ error: 'Name is required' });

  const unitExists = db.prepare('SELECT 1 FROM units WHERE name = ?').get(unit);
  if (!unitExists) return res.status(400).json({ error: `Unknown unit: ${unit}` });

  try {
    const result = db
      .prepare('INSERT INTO ingredients (name, unit) VALUES (?, ?)')
      .run(trimmed, unit);
    const created = db
      .prepare('SELECT * FROM ingredients WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: `"${trimmed}" already exists` });
    }
    throw err;
  }
});

// Delete an ingredient
app.delete('/api/ingredients/:id', (req, res) => {
  const result = db.prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));