import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { guessPlural } from '../format.js'

const byName = (a, b) => a.name.localeCompare(b.name)

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([])
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  // the ingredient being edited: { id, name, pluralName } or null
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    api('/ingredients')
      .then(setIngredients)
      .catch((err) => setError(err.message))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    try {
      const created = await api('/ingredients', { method: 'POST', body: { name } })
      setIngredients((list) => [...list, created].sort(byName))
      setName('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSave() {
    setError('')
    try {
      const updated = await api(`/ingredients/${editing.id}`, {
        method: 'PUT',
        body: { name: editing.name, pluralName: editing.pluralName },
      })
      setIngredients((list) => list.map((i) => (i.id === updated.id ? updated : i)).sort(byName))
      setEditing(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(ingredient) {
    if (!confirm(`Delete "${ingredient.name}"?`)) return
    setError('')
    try {
      await api(`/ingredients/${ingredient.id}`, { method: 'DELETE' })
      setIngredients((list) => list.filter((i) => i.id !== ingredient.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const visible = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <section>
      <h2>Ingredients</h2>

      <form className="row" onSubmit={handleAdd}>
        <input
          placeholder="Ingredient name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">Add</button>
      </form>

      {error && <p className="error">{error}</p>}

      <input
        className="search"
        placeholder="Search ingredients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {visible.length === 0 ? (
        <p className="muted">No ingredients found.</p>
      ) : (
        <ul className="list">
          {visible.map((i) =>
            editing?.id === i.id ? (
              <li key={i.id}>
                <input
                  aria-label="Name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
                <input
                  aria-label="Plural"
                  placeholder={`Plural, e.g. ${guessPlural(editing.name)}`}
                  value={editing.pluralName}
                  onChange={(e) => setEditing({ ...editing, pluralName: e.target.value })}
                />
                <button onClick={handleSave}>Save</button>
                <button className="link" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </li>
            ) : (
              <li key={i.id}>
                <span className="grow">
                  {i.name}
                  {i.plural_name && <span className="muted"> / {i.plural_name}</span>}
                </span>
                <span className="muted">
                  {i.recipe_count === 0
                    ? 'not used'
                    : `used in ${i.recipe_count} recipe${i.recipe_count === 1 ? '' : 's'}`}
                </span>
                <button
                  className="link"
                  onClick={() =>
                    setEditing({ id: i.id, name: i.name, pluralName: i.plural_name ?? '' })
                  }
                >
                  Edit
                </button>
                <button
                  className="link danger"
                  onClick={() => handleDelete(i)}
                  disabled={i.recipe_count > 0}
                  title={i.recipe_count > 0 ? 'Used in a recipe' : undefined}
                >
                  Delete
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  )
}
