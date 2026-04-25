import { Plus, Trash2 } from 'lucide-react'
import { emptyKV } from '../hooks/useRequest'

export default function KeyValueTable({
  rows,
  onChange,
  showToggle = true,
  addLabel = 'Add row',
}) {
  const update = (id, patch) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const remove = (id) => {
    if (rows.length <= 1) {
      onChange([emptyKV()])
      return
    }
    onChange(rows.filter((r) => r.id !== id))
  }

  const add = () => onChange([...rows, emptyKV()])

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 text-xs text-gray-500 uppercase tracking-wide px-1">
        {showToggle && <span className="w-8">On</span>}
        <span>Key</span>
        <span>Value</span>
        <span className="w-8" />
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center"
        >
          {showToggle && (
            <input
              type="checkbox"
              checked={row.enabled !== false}
              onChange={(e) => update(row.id, { enabled: e.target.checked })}
              className="accent-emerald-600 w-4 h-4 justify-self-center"
              title="Enabled"
            />
          )}
          <input
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-600/60"
            placeholder="Key"
            value={row.key}
            onChange={(e) => update(row.id, { key: e.target.value })}
          />
          <input
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-600/60"
            placeholder="Value"
            value={row.value}
            onChange={(e) => update(row.id, { value: e.target.value })}
          />
          <button
            type="button"
            onClick={() => remove(row.id)}
            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="mt-1 flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 self-start"
      >
        <Plus className="w-4 h-4" />
        {addLabel}
      </button>
    </div>
  )
}
