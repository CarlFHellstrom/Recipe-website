import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatAmount, formatLine, parseAmount } from '../format.js'
import IngredientPicker from './IngredientPicker.jsx'
import UnitSelect from './UnitSelect.jsx'

const newKey = () => crypto.randomUUID()

// Swap item at `index` with its neighbour (direction -1 = up, +1 = down)
function move(list, index, direction) {
  const target = index + direction
  if (target < 0 || target >= list.length) return list
  const copy = [...list]
  ;[copy[index], copy[target]] = [copy[target], copy[index]]
  return copy
}

/*
  Used both for creating and editing.
  - <RecipeForm onSaved={…} />                 creates a new recipe
  - <RecipeForm recipeId={5} onSaved={…} />    edits recipe 5
*/
export default function RecipeForm({ recipeId = null, onSaved, onCancel }) {
  const isEdit = recipeId !== null

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [yieldAmount, setYieldAmount] = useState('')
  const [yieldUnit, setYieldUnit] = useState('')
  // each line: { key, ingredientId, name, pluralName, amount, maxAmount, unit, optional, note }
  // amount/maxAmount are kept as the typed text ("1½") and parsed when saving;
  // unit '' = counted item
  const [lines, setLines] = useState([])
  const [steps, setSteps] = useState([{ key: newKey(), text: '' }])

  const [allIngredients, setAllIngredients] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const requests = [api('/ingredients'), api('/units')]
    if (isEdit) requests.push(api(`/recipes/${recipeId}`))

    Promise.all(requests)
      .then(([ingredientList, unitList, recipe]) => {
        setAllIngredients(ingredientList)
        setUnits(unitList)
        if (recipe) fillForm(recipe)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [recipeId])

  function fillForm(recipe) {
    setName(recipe.name)
    setDescription(recipe.description ?? '')
    setYieldAmount(recipe.yield_amount ? formatAmount(recipe.yield_amount) : '')
    setYieldUnit(recipe.yield_unit ?? '')
    setLines(
      recipe.ingredients.map((i) => ({
        key: newKey(),
        ingredientId: i.ingredient_id,
        name: i.name,
        pluralName: i.plural_name ?? '',
        amount: formatAmount(i.amount),
        maxAmount: i.max_amount ? formatAmount(i.max_amount) : '',
        unit: i.unit ?? '',
        optional: i.optional,
        note: i.note ?? '',
      }))
    )
    setSteps(recipe.steps.map((s) => ({ key: newKey(), text: s.instruction })))
  }

  // ----- ingredient lines -----
  const unitPlurals = Object.fromEntries(units.map((u) => [u.unit, u.plural]))

  // Checks a line; returns an error message or '' if it's fine
  function lineProblem(l) {
    const amount = parseAmount(l.amount)
    if (!(amount > 0)) return 'Amount must be a number like 2, 1.5, 1/2 or 1 1/2'
    if (l.maxAmount.trim() && !(parseAmount(l.maxAmount) > amount))
      return 'The “to” amount must be bigger than the amount'
    return ''
  }

  // How the line will look in the recipe, e.g. "1–2 red onions (large)"
  function previewLine(l) {
    return formatLine({
      amount: parseAmount(l.amount),
      max_amount: l.maxAmount.trim() ? parseAmount(l.maxAmount) : null,
      unit: l.unit || null,
      unit_plural: unitPlurals[l.unit],
      name: l.name,
      plural_name: l.pluralName,
      note: l.note.trim(),
      optional: l.optional,
    })
  }

  function addLine(line) {
    setLines((ls) => [...ls, { ...line, optional: false, note: '', key: newKey() }])
  }
  function updateLine(key, changes) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...changes } : l)))
  }
  function removeLine(key) {
    setLines((ls) => ls.filter((l) => l.key !== key))
  }

  // ----- steps -----
  function addStep() {
    setSteps((s) => [...s, { key: newKey(), text: '' }])
  }
  function updateStep(key, text) {
    setSteps((s) => s.map((step) => (step.key === key ? { ...step, text } : step)))
  }
  function removeStep(key) {
    setSteps((s) => (s.length > 1 ? s.filter((step) => step.key !== key) : s))
  }

  // ----- submit -----
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const filledSteps = steps.map((s) => s.text.trim()).filter(Boolean)
    if (lines.length === 0) return setError('Add at least one ingredient.')
    const badLine = lines.findIndex((l) => lineProblem(l))
    if (badLine !== -1) return setError(`Ingredient ${badLine + 1}: ${lineProblem(lines[badLine])}`)
    if (filledSteps.length === 0) return setError('Add at least one step.')
    if (yieldUnit.trim() && !yieldAmount) return setError('Enter a number for “Makes”.')
    if (yieldAmount && !(parseAmount(yieldAmount) > 0))
      return setError('“Makes” must be a number, e.g. 4 or 1 1/2.')

    const body = {
      name,
      description,
      yieldAmount: yieldAmount.trim() === '' ? null : parseAmount(yieldAmount),
      yieldUnit,
      ingredients: lines.map((l) => ({
        ...(l.ingredientId !== null
          ? { ingredientId: l.ingredientId }
          : { name: l.name, pluralName: l.pluralName }),
        amount: parseAmount(l.amount),
        maxAmount: l.maxAmount.trim() ? parseAmount(l.maxAmount) : null,
        unit: l.unit || null,
        optional: l.optional,
        note: l.note,
      })),
      steps: filledSteps,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await api(`/recipes/${recipeId}`, { method: 'PUT', body })
      } else {
        await api('/recipes', { method: 'POST', body })
      }
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) return <p className="muted">Loading…</p>

  return (
    <form className="recipe-form" onSubmit={handleSubmit}>
      <h2>{isEdit ? `Edit “${name}”` : 'New recipe'}</h2>

      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label>
        Description <span className="muted">(optional)</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field-label">
          Makes <span className="muted">(optional)</span>
        </span>
        <div className="row">
          <input
            className="amount"
            placeholder="4"
            value={yieldAmount}
            onChange={(e) => setYieldAmount(e.target.value)}
          />
          <input
            placeholder="servings, pancakes, cookies…"
            value={yieldUnit}
            onChange={(e) => setYieldUnit(e.target.value)}
          />
        </div>
      </div>

      <fieldset>
        <legend>Ingredients</legend>

        {lines.length > 0 && (
          <ul className="lines">
            {lines.map((l, i) => (
              <li key={l.key}>
                <div className="row">
                  <input
                    className="amount"
                    aria-label="Amount"
                    value={l.amount}
                    onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                  />
                  <span className="muted">to</span>
                  <input
                    className="amount"
                    aria-label="To amount (optional)"
                    placeholder="–"
                    value={l.maxAmount}
                    onChange={(e) => updateLine(l.key, { maxAmount: e.target.value })}
                  />
                  <UnitSelect
                    units={units}
                    value={l.unit}
                    onChange={(unit) => updateLine(l.key, { unit })}
                  />
                  <span className="grow">
                    <strong>{l.name}</strong>
                    {l.ingredientId === null && <span className="badge">new</span>}
                  </span>
                  <button type="button" className="link" onClick={() => setLines((ls) => move(ls, i, -1))} disabled={i === 0}>
                    ▲
                  </button>
                  <button type="button" className="link" onClick={() => setLines((ls) => move(ls, i, 1))} disabled={i === lines.length - 1}>
                    ▼
                  </button>
                  <button type="button" className="link danger" onClick={() => removeLine(l.key)}>
                    Remove
                  </button>
                </div>
                <div className="row line-extra">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={l.optional}
                      onChange={(e) => updateLine(l.key, { optional: e.target.checked })}
                    />
                    Optional
                  </label>
                  <input
                    className="grow"
                    placeholder="Note, e.g. large, chopped, for serving…"
                    value={l.note}
                    onChange={(e) => updateLine(l.key, { note: e.target.value })}
                  />
                </div>
                <div className="line-extra hint">
                  {lineProblem(l) ? (
                    <span className="error-text">{lineProblem(l)}</span>
                  ) : (
                    <span className="muted">→ {previewLine(l)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <IngredientPicker ingredients={allIngredients} units={units} onAdd={addLine} />
      </fieldset>

      <fieldset>
        <legend>Steps</legend>
        <ol className="steps">
          {steps.map((step, i) => (
            <li key={step.key}>
              <textarea
                rows={2}
                placeholder={`Step ${i + 1}`}
                value={step.text}
                onChange={(e) => updateStep(step.key, e.target.value)}
              />
              <div className="step-actions">
                <button type="button" className="link" onClick={() => setSteps((s) => move(s, i, -1))} disabled={i === 0}>
                  ▲
                </button>
                <button type="button" className="link" onClick={() => setSteps((s) => move(s, i, 1))} disabled={i === steps.length - 1}>
                  ▼
                </button>
                <button
                  type="button"
                  className="link danger"
                  onClick={() => removeStep(step.key)}
                  disabled={steps.length === 1}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={addStep}>
          + Add step
        </button>
      </fieldset>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save recipe'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
