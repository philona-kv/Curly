import { useState } from 'react'
import {
  FolderPlus,
  Trash2,
  ChevronRight,
  History,
  Layers,
  Save,
  Download,
  Upload,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ''
  }
}

export default function Sidebar({
  collections,
  createCollection,
  renameCollection,
  deleteCollection,
  addItem,
  removeItem,
  exportCollection,
  history,
  clearHistory,
  onSelectHistory,
  onSelectSavedRequest,
  onSelectChain,
  onSaveRequest,
  buildSavePayload,
  onImportCollectionFile,
}) {
  const [openCol, setOpenCol] = useState({})
  const [newName, setNewName] = useState('')
  const [saveOpen, setSaveOpen] = useState(null)

  const toggleCol = (id) =>
    setOpenCol((o) => ({ ...o, [id]: !o[id] }))

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0f0f0f] border-r border-gray-800">
      <div className="p-2 border-b border-gray-800 flex items-center gap-2">
        <input
          className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs"
          placeholder="New collection name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="button"
          title="Create collection"
          onClick={() => {
            const n = newName.trim() || 'New Collection'
            createCollection(n)
            setNewName('')
            toast.success(`Collection “${n}” created`)
          }}
          className="p-2 rounded bg-gray-800 text-gray-200 hover:bg-gray-700"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
        <label className="p-2 rounded bg-gray-800 text-gray-200 hover:bg-gray-700 cursor-pointer">
          <Upload className="w-4 h-4" />
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onImportCollectionFile(f)
            }}
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-gray-500">
          Collections
        </div>
        {collections.map((col) => (
          <div key={col.id} className="border-b border-gray-900">
            <div className="flex items-center gap-1 px-2 py-1">
              <button
                type="button"
                className="p-0.5 text-gray-500"
                onClick={() => toggleCol(col.id)}
              >
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    openCol[col.id] ? 'rotate-90' : ''
                  }`}
                />
              </button>
              <input
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 border border-transparent hover:border-gray-700 rounded px-1"
                value={col.name}
                onChange={(e) => renameCollection(col.id, e.target.value)}
              />
              <button
                type="button"
                title="Save current request here"
                onClick={() => setSaveOpen(col.id)}
                className="p-1 text-gray-500 hover:text-emerald-400"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Export"
                onClick={() => {
                  exportCollection(col)
                  toast.success(`Exported “${col.name}”`)
                }}
                className="p-1 text-gray-500 hover:text-sky-400"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Delete collection"
                onClick={() => {
                  if (confirm(`Delete collection “${col.name}”?`)) {
                    deleteCollection(col.id)
                    toast.success('Collection deleted')
                  }
                }}
                className="p-1 text-gray-500 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {openCol[col.id] && (
              <ul className="pl-6 pb-2 space-y-0.5">
                {col.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-1 group">
                    <button
                      type="button"
                      className="flex-1 text-left text-xs py-1 px-1 rounded text-gray-400 hover:bg-gray-900 hover:text-gray-100 flex items-center gap-1"
                      onClick={() =>
                        item.type === 'chain'
                          ? onSelectChain(item, col.id)
                          : onSelectSavedRequest(item, col.id)
                      }
                    >
                      {item.type === 'chain' ? (
                        <Link2 className="w-3 h-3 shrink-0 text-violet-400" />
                      ) : (
                        <Layers className="w-3 h-3 shrink-0 text-gray-600" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </button>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400"
                      onClick={() => {
                        removeItem(col.id, item.id)
                        toast.success('Removed from collection')
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 max-h-[40%] flex flex-col min-h-0">
        <div className="flex items-center justify-between px-2 py-1 border-b border-gray-900">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">
            <History className="w-3.5 h-3.5" />
            History
          </div>
          <button
            type="button"
            onClick={() => {
              clearHistory()
              toast.success('History cleared')
            }}
            className="text-[10px] text-gray-500 hover:text-red-400"
          >
            Clear
          </button>
        </div>
        <ul className="overflow-auto flex-1">
          {history.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-gray-900 border-b border-gray-900/50"
                onClick={() => onSelectHistory(h)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-amber-400 shrink-0">
                    {h.method}
                  </span>
                  <span
                    className={`text-[10px] shrink-0 ${
                      h.status >= 200 && h.status < 300
                        ? 'text-emerald-500'
                        : 'text-red-400'
                    }`}
                  >
                    {h.status ?? '—'}
                  </span>
                </div>
                <div className="text-xs text-gray-400 truncate">{h.url}</div>
                <div className="text-[10px] text-gray-600 flex justify-between gap-2">
                  <span>{formatTime(h.at)}</span>
                  {h.environment && (
                    <span className="truncate text-gray-500">{h.environment}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {saveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-full max-w-sm shadow-xl">
            <div className="text-sm font-medium text-gray-200 mb-2">Save request</div>
            <input
              autoFocus
              className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-2 text-sm mb-3"
              placeholder="Request name"
              id="save-req-name"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                onClick={() => setSaveOpen(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white"
                onClick={() => {
                  const el = document.getElementById('save-req-name')
                  const name = el?.value?.trim() || 'Untitled'
                  const payload = buildSavePayload()
                  addItem(saveOpen, { ...payload, name, type: 'request' })
                  setSaveOpen(null)
                  toast.success(`Saved “${name}”`)
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
