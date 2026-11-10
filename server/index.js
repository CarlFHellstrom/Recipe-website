import express from 'express';
import db from './db.js';
import ingredientsRouter from './routes/ingredients.js';
import recipesRouter from './routes/recipes.js';

const app = express();
app.use(express.json());

// List all units (for the dropdowns)
app.get('/api/units', (req, res) => {
  // [{ unit: 'cup', plural: 'cups' }, ...]
  res.json(db.prepare('SELECT unit, plural FROM units ORDER BY rowid').all());
});

app.use('/api/ingredients', ingredientsRouter);
app.use('/api/recipes', recipesRouter);

// Error handler: errors thrown with a .status (see HttpError) are sent to the
// client as { error: message }; anything else is logged and becomes a 500.
app.use((err, req, res, next) => {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
