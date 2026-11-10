import { useState } from 'react'
import { guessPlural, parseAmount } from '../format.js'
import UnitSelect from './UnitSelect.jsx'

/*
  Search box for adding an ingredient line to a recipe.
  1. Type to search existing ingredients and click one,
     or choose "Create …" to use a brand-new ingredient.
  2. Enter the amount (optionally a "to" amount for ranges), pick the unit, press Add.
  (Optional / note can be set on the line in the list afterwards.)

  Props:
    ingredients  existing ingredients ({ id, name, plural_name, last_unit })
    units        [{ unit, plural }]
    onAdd(line)  called with { ingredientId, name, pluralName, amount, maxAmount, unit }
                 amount/maxAmount are the typed text, e.g. "1½"
                 (ingredientId is null for a new ingredient)
*/
export default function IngredientPicker({ ingredients, units, onAdd }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null) // { ingredientId, name, pluralName }
  const [amount, setAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [unit, setUnit] = useState('')

  const q = query.trim().toLowerCase()
  const matches = q
    ? ingredients.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8)
    : []
  const exactExists = ingredients.some((i) => i.name.toLowerCase() === q)

  function pickExisting(ingredient) {
    setSelected({
      ingredientId: ingredient.id,
      name: ingredient.name,
      pluralName: ingredient.plural_name ?? '',
    })
    // last_unit: null = never used, '' = used as a counted item
    setUnit(ingredient.last_unit ?? units[0]?.unit ?? '')
  }

  function pickNew() {
    const name = query.trim()
    setSelected({ ingredientId: null, name, pluralName: guessPlural(name) })
    setUnit(units[0]?.unit ?? '')
  }

  function reset() {
    setQuery('')
    setSelected(null)
    setAmount('')
    setMaxAmount('')
  }

  const amountValid = parseAmount(amount) > 0
  const maxValid = maxAmount.trim() === '' || parseAmount(maxAmount) > parseAmount(amount)

  function handleAdd() {
    if (!amountValid || !maxValid) return
    onAdd({ ...selected, amount, maxAmount, unit })
    reset()
  }

  const addOnEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  // Step 2: an ingredient is chosen, ask for amount and unit
  if (selected) {
    return (
      <div className="picker">
        <div className="row">
          <strong>{selected.name}</strong>
          {selected.ingredientId === null && <span className="badge">new</span>}

          <input
            className="amount"
            placeholder="Amount"
            title="e.g. 2, 1.5, 1/2, 1 1/2"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={addOnEnter}
            autoFocus
          />
          <span className="muted">to</span>
          <input
            className="amount"
            placeholder="(optional)"
            title="For ranges like 1–2"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            onKeyDown={addOnEnter}
          />

          <UnitSelect units={units} value={unit} onChange={setUnit} />

          <button type="button" onClick={handleAdd} disabled={!amountValid || !maxValid}>
            Add
          </button>
          <button type="button" className="link" onClick={reset}>
            Cancel
          </button>
        </div>

        {selected.ingredientId === null && unit === '' && (
          <label className="row plural-field">
            <span className="muted">Plural:</span>
            <input
              value={selected.pluralName}
              onChange={(e) => setSelected({ ...selected, pluralName: e.target.value })}
            />
          </label>
        )}

        {amount.trim() && !amountValid && (
          <p className="hint error-text">Amount must be a number like 2, 1.5, 1/2 or 1 1/2</p>
        )}
        {amountValid && !maxValid && (
          <p className="hint error-text">The “to” amount must be bigger than the amount</p>
        )}
      </div>
    )
  }

  // Step 1: search
  return (
    <div className="picker">
      <input
        placeholder="Search ingredients or type a new one…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
      />

      {q && (
        <ul className="suggestions">
          {matches.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => pickExisting(i)}>
                {i.name}
              </button>
            </li>
          ))}
          {!exactExists && (
            <li>
              <button type="button" className="create" onClick={pickNew}>
                + Create new ingredient “{query.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
