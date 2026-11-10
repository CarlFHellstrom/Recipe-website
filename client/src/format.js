// ---------------------------------------------------------------------------
// Fractions
// ---------------------------------------------------------------------------

const FRACTIONS = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
]

const GLYPH_VALUES = Object.fromEntries(FRACTIONS.map(([value, glyph]) => [glyph, value]))

/*
  Number -> display text, using fraction characters where they fit:
    0.5 -> "½"   1.5 -> "1½"   0.333 -> "⅓"   2 -> "2"   2.3 -> "2.3"
*/
export function formatAmount(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return ''

  const whole = Math.floor(value)
  const rest = value - whole

  if (rest < 0.01) return String(whole)
  if (rest > 0.99) return String(whole + 1)

  const match = FRACTIONS.find(([fraction]) => Math.abs(rest - fraction) < 0.01)
  if (match) return `${whole || ''}${match[1]}`

  return String(Number(value.toFixed(2))) // e.g. 2.3, 0.15
}

/*
  Text typed by the user -> number (or NaN if it isn't a valid amount).
  Accepts: "2", "1.5", "1,5", "1/2", "1 1/2", "½", "1½"
*/
export function parseAmount(text) {
  let s = String(text ?? '').trim().replace(',', '.')
  if (!s) return NaN

  // "1½" -> "1 + 0.5"
  let glyphPart = 0
  const last = s.slice(-1)
  if (last in GLYPH_VALUES) {
    glyphPart = GLYPH_VALUES[last]
    s = s.slice(0, -1).trim()
    if (!s) return glyphPart
  }

  const match = s.match(/^(\d+(?:\.\d+)?)?\s*(?:(\d+)\/(\d+))?$/)
  if (!match || (!match[1] && !match[2])) return NaN
  if (glyphPart && match[2]) return NaN // "1/2½" makes no sense

  const whole = match[1] ? Number(match[1]) : 0
  const fraction = match[2] ? Number(match[2]) / Number(match[3]) : 0
  if (!Number.isFinite(fraction)) return NaN // division by zero

  return whole + fraction + glyphPart
}

// ---------------------------------------------------------------------------
// Singular / plural
// ---------------------------------------------------------------------------

// Plural when more than one, or when it's a range ("1–2 onions", "½ cup", "1½ cups")
export const isPlural = (amount, maxAmount) =>
  (maxAmount !== null && maxAmount !== undefined) || Number(amount) > 1

// A starting suggestion for the plural of a new ingredient. Always editable,
// because English has many exceptions (leaf -> leaves, avocado -> avocados).
export function guessPlural(name) {
  const s = name.trim()
  if (!s) return ''
  if (/(s|x|z|ch|sh|o)$/i.test(s)) return `${s}es` // tomato -> tomatoes, peach -> peaches
  if (/[^aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies` // cherry -> cherries
  return `${s}s` // onion -> onions
}

/*
  One ingredient line as text, e.g.
    "1–2 red onions (large)"
    "3 cloves garlic"
    "½ cup milk (optional)"
  `line` uses the API's field names:
    { amount, max_amount, unit, unit_plural, name, plural_name, note, optional }
*/
export function formatLine(line) {
  const plural = isPlural(line.amount, line.max_amount)

  let amountText = formatAmount(line.amount)
  if (line.max_amount) amountText += `–${formatAmount(line.max_amount)}`

  let text
  if (line.unit) {
    const unitText = plural ? line.unit_plural || line.unit : line.unit
    text = `${amountText} ${unitText} ${line.name.toLowerCase()}`
  } else {
    // no plural saved yet -> use the guess ("Egg" -> "Eggs")
    const nameText = plural ? line.plural_name || guessPlural(line.name) : line.name
    text = `${amountText} ${nameText.toLowerCase()}`
  }

  const extras = [line.note, line.optional && 'optional'].filter(Boolean)
  if (extras.length) text += ` (${extras.join(', ')})`
  return text
}

// "12 pancakes", "4 servings" or '' if not set
export const formatYield = (recipe) =>
  recipe.yield_amount
    ? `${formatAmount(recipe.yield_amount)} ${recipe.yield_unit ?? 'servings'}`
    : ''
