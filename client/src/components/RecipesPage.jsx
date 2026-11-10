import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatLine, formatYield } from '../format.js'

export default function RecipesPage({ onEdit }) {
  const [recipes, setRecipes] = useState([])
  const [openId, setOpenId] = useState(null)
  const [details, setDetails] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/recipes').then(setRecipes).catch((err) => setError(err.message))
  }, [])

  async function toggle(id) {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    setDetails(null)
    try {
      setDetails(await api(`/recipes/${id}`))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(recipe) {
    if (!confirm(`Delete the recipe "${recipe.name}"?`)) return
    try {
      await api(`/recipes/${recipe.id}`, { method: 'DELETE' })
      setRecipes((rs) => rs.filter((r) => r.id !== recipe.id))
      if (openId === recipe.id) setOpenId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <h2>Recipes</h2>
      {error && <p className="error">{error}</p>}
      {recipes.length === 0 && <p className="muted">No recipes yet. Add one under “New recipe”.</p>}

      {recipes.map((r) => (
        <article key={r.id} className="recipe-card">
          <div className="row spread">
            <button className="link title" onClick={() => toggle(r.id)}>
              {r.name}
            </button>
            <span className="muted">
              {formatYield(r) && `Makes ${formatYield(r)} · `}
              {r.ingredient_count} ingredients · {r.step_count} steps
            </span>
          </div>

          {openId === r.id && details && (
            <div className="recipe-details">
              {details.description && <p>{details.description}</p>}

              <h3>Ingredients</h3>
              <ul>
                {details.ingredients.map((line, index) => (
                  <li key={index}>{formatLine(line)}</li>
                ))}
              </ul>

              <h3>Steps</h3>
              <ol>
                {details.steps.map((s) => (
                  <li key={s.step_number}>{s.instruction}</li>
                ))}
              </ol>

              <div className="row">
                <button className="link" onClick={() => onEdit(r.id)}>
                  Edit recipe
                </button>
                <button className="link danger" onClick={() => handleDelete(r)}>
                  Delete recipe
                </button>
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
