import { useMemo, useState } from 'react'
import {
  X,
  Plus,
  Copy,
  Trash2,
  Upload,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { parseEnvironmentImport } from '../hooks/useEnvironments'
import { detectCircularInValues } from '../utils/variableResolver'

function VarRow({
  v,
  envName,
  currentVal,
  onChange,
  onDelete,
  onCurrent,
  onToggleSecret,
}) {
  const [show, setShow] = useState(false)
  const masked = v.secret && !show
  return (
    <tr className="border-b border-gray-800 text-xs">
      <td className="py-1 pr-1">
        <input
          className="w-full bg-gray-950 border border-gray-800 rounded px-1 py-1"
          value={v.name}
          onChange={(e) => onChange({ ...v, name: e.target.value })}
        />
      </td>
      <td className="py-1 pr-1">
        <input
          className="w-full bg-gray-950 border border-gray-800 rounded px-1 py-1"
          type={masked ? 'password' : 'text'}
          placeholder="Initial (exported)"
          value={v.initialValue ?? ''}
          onChange={(e) => onChange({ ...v, initialValue: e.target.value })}
        />
      </td>
      <td className="py-1 pr-1">
        <input
          className="w-full bg-gray-950 border border-gray-800 rounded px-1 py-1"
          type={masked ? 'password' : 'text'}
          placeholder="Current (local)"
          value={currentVal ?? ''}
          onChange={(e) => onCurrent(e.target.value)}
        />
      </td>
      <td className="py-1 pr-1 text-center">
        <input
          type="checkbox"
          checked={!!v.secret}
          onChange={() => onToggleSecret()}
          title="Secret"
          className="accent-emerald-600"
        />
      </td>
      <td className="py-1 flex gap-1 justify-end">
        {v.secret && (
          <button
            type="button"
            className="p-1 text-gray-500 hover:text-gray-300"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          type="button"
          className="p-1 text-gray-500 hover:text-red-400"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

export default function EnvironmentManager({
  open,
  onClose,
  environments,
  setEnvironments,
  currentValues,
  setCurrentValues,
  activeName,
  setActiveName,
  checkCircular,
}) {
  const [selected, setSelected] = useState(activeName || 'Globals')
  const env = useMemo(
    () => environments.find((e) => e.name === selected),
    [environments, selected],
  )

  if (!open) return null

  const vars = env?.variables || []

  const updateVars = (next) => {
    setEnvironments((prev) =>
      prev.map((e) => (e.name === selected ? { ...e, variables: next } : e)),
    )
  }

  const onImportFile = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const chunks = parseEnvironmentImport(String(reader.result))
        const first = chunks[0]
        const existing = environments.find((e) => e.name === first.name)
        let mode = 'merge'
        if (existing) {
          const choice = window.prompt(
            `Environment “${first.name}” exists. Type replace, merge, or both:`,
            'merge',
          )
          mode = (choice || 'merge').toLowerCase()
        }
        for (const chunk of chunks) {
          setEnvironments((prev) => {
            const idx = prev.findIndex((e) => e.name === chunk.name)
            if (idx === -1) {
              return [
                ...prev,
                {
                  id: `env_${Math.random().toString(36).slice(2)}`,
                  name: chunk.name,
                  variables: chunk.variables,
                },
              ]
            }
            if (mode === 'replace') {
              return prev.map((e, i) =>
                i === idx ? { ...e, variables: chunk.variables } : e,
              )
            }
            if (mode === 'both') {
              return [
                ...prev,
                {
                  id: `env_${Math.random().toString(36).slice(2)}`,
                  name: `${chunk.name} (imported)`,
                  variables: chunk.variables,
                },
              ]
            }
            const cur = prev[idx]
            const merged = [...(cur.variables || [])]
            for (const nv of chunk.variables) {
              const j = merged.findIndex((m) => m.name === nv.name)
              if (j === -1) merged.push(nv)
              else merged[j] = { ...merged[j], ...nv }
            }
            return prev.map((e, i) => (i === idx ? { ...e, variables: merged } : e))
          })
        }
        toast.success(`Imported ${first.variables?.length || 0} variables into ${first.name}`)
      } catch (e) {
        toast.error(e?.message || 'Import failed')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#111827] border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-100">Environments</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-800 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-48 border-r border-gray-800 overflow-auto shrink-0">
            {environments.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelected(e.name)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-900 ${
                  selected === e.name
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:bg-gray-900/50'
                }`}
              >
                {e.name}
              </button>
            ))}
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-xs text-emerald-400 hover:bg-gray-900/50"
              onClick={() => {
                const name = window.prompt('Environment name', 'Staging')
                if (!name) return
                setEnvironments((prev) => [
                  ...prev,
                  { id: `env_${Date.now()}`, name, variables: [] },
                ])
                setSelected(name)
                toast.success(`Environment “${name}” created`)
              }}
            >
              + Add environment
            </button>
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-gray-800">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-gray-900"
                onClick={() => {
                  const cur = environments.find((e) => e.name === selected)
                  if (!cur) return
                  setEnvironments((prev) => [
                    ...prev,
                    {
                      id: `env_${Date.now()}`,
                      name: `${cur.name} Copy`,
                      variables: (cur.variables || []).map((v) => ({ ...v })),
                    },
                  ])
                  setSelected(`${cur.name} Copy`)
                  toast.success('Duplicated environment')
                }}
              >
                <Copy className="w-3.5 h-3.5 inline mr-1" />
                Duplicate
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-red-900 text-red-300 hover:bg-red-950/30"
                onClick={() => {
                  if (selected === 'Globals') {
                    toast.error('Cannot delete Globals')
                    return
                  }
                  if (!confirm(`Delete environment “${selected}”?`)) return
                  setEnvironments((prev) => prev.filter((e) => e.name !== selected))
                  setCurrentValues((prev) => {
                    const n = { ...prev }
                    delete n[selected]
                    return n
                  })
                  if (activeName === selected) {
                    setActiveName('Globals')
                    toast.warning('Active environment was deleted — fell back to Globals')
                  } else toast.success('Environment deleted')
                  setSelected('Globals')
                }}
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                Delete
              </button>
              <label className="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-gray-900 cursor-pointer">
                <Upload className="w-3.5 h-3.5 inline mr-1" />
                Import
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) onImportFile(f)
                  }}
                />
              </label>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-gray-900"
                onClick={() => {
                  const cur = environments.find((e) => e.name === selected)
                  if (!cur) return
                  const payload = {
                    format: 'api-playground-environment',
                    version: 1,
                    name: cur.name,
                    variables: (cur.variables || []).map((v) => ({
                      name: v.name,
                      initialValue: v.initialValue ?? '',
                      secret: !!v.secret,
                    })),
                  }
                  const blob = new Blob([JSON.stringify(payload, null, 2)], {
                    type: 'application/json',
                  })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `${cur.name}-environment.json`
                  a.click()
                  URL.revokeObjectURL(a.href)
                  toast.success('Environment exported (initial values only)')
                }}
              >
                <Download className="w-3.5 h-3.5 inline mr-1" />
                Export this
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-gray-900"
                onClick={() => {
                  const arr = environments.map((e) => ({
                    format: 'api-playground-environment',
                    version: 1,
                    name: e.name,
                    variables: (e.variables || []).map((v) => ({
                      name: v.name,
                      initialValue: v.initialValue ?? '',
                      secret: !!v.secret,
                    })),
                  }))
                  const blob = new Blob([JSON.stringify(arr, null, 2)], {
                    type: 'application/json',
                  })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = 'all-environments.json'
                  a.click()
                  URL.revokeObjectURL(a.href)
                  toast.success('Exported all environments')
                }}
              >
                Export all
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-gray-800">
                    <th className="pb-1 pr-1">Name</th>
                    <th className="pb-1 pr-1">Initial</th>
                    <th className="pb-1 pr-1">Current</th>
                    <th className="pb-1 pr-1 w-10">Secret</th>
                    <th className="pb-1 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {vars.map((v, i) => (
                    <VarRow
                      key={`${v.name}-${i}`}
                      v={v}
                      envName={selected}
                      currentVal={currentValues[selected]?.[v.name]}
                      onChange={(nv) => {
                        const next = vars.slice()
                        next[i] = nv
                        updateVars(next)
                      }}
                      onDelete={() => {
                        updateVars(vars.filter((_, j) => j !== i))
                        setCurrentValues((prev) => {
                          const n = { ...prev, [selected]: { ...prev[selected] } }
                          delete n[selected][v.name]
                          return n
                        })
                      }}
                      onCurrent={(val) => {
                        setCurrentValues((prev) => ({
                          ...prev,
                          [selected]: { ...prev[selected], [v.name]: val },
                        }))
                      }}
                      onToggleSecret={() => {
                        const next = vars.slice()
                        next[i] = { ...v, secret: !v.secret }
                        updateVars(next)
                      }}
                    />
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                onClick={() =>
                  updateVars([
                    ...vars,
                    { name: '', initialValue: '', secret: false },
                  ])
                }
              >
                <Plus className="w-3.5 h-3.5" />
                Add variable
              </button>
              <div className="mt-4 text-[11px] text-gray-500">
                Current values stay in this browser only and are never exported.
                Circular references are flagged when saving usage in requests.
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-amber-400 hover:text-amber-300"
                onClick={() => {
                  const r = detectCircularInValues(activeName, environments, currentValues)
                  if (r.circular) toast.error(`Circular reference around “${r.path}”`)
                  else toast.success('No circular references detected')
                }}
              >
                Check circular references
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
