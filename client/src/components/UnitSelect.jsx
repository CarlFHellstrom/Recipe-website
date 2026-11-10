// Unit dropdown. value '' means "no unit" (a counted item, e.g. "2 onions").
export default function UnitSelect({ units, value, onChange }) {
  return (
    <select aria-label="Unit" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">– (count)</option>
      {units.map((u) => (
        <option key={u.unit} value={u.unit}>
          {u.unit}
        </option>
      ))}
    </select>
  )
}
