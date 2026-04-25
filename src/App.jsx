import { useCallback, useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Globe, Link2, PlayCircle, Sparkles } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import Sidebar from './components/Sidebar'
import RequestBuilder from './components/RequestBuilder'
import ResponseViewer from './components/ResponseViewer'
import ChainBuilder from './components/ChainBuilder'
import EnvironmentManager from './components/EnvironmentManager'
import AIAssistant from './components/AIAssistant'
import { useCollections, parseCollectionImport } from './hooks/useCollections'
import { useHistory } from './hooks/useHistory'
import { useRequest, defaultRequest } from './hooks/useRequest'
import { useChain } from './hooks/useChain'
import { useEnvironments } from './hooks/useEnvironments'
import { createEnvLookup } from './utils/variableResolver'
import { uid } from './utils/storage'

function cloneRequestLike(item) {
  return {
    ...defaultRequest(),
    ...JSON.parse(JSON.stringify(item || {})),
  }
}

function App() {
  const collections = useCollections()
  const history = useHistory()
  const req = useRequest()
  const chain = useChain()
  const env = useEnvironments()

  const [request, setRequest] = useState(() => defaultRequest())
  const [showEnvManager, setShowEnvManager] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [importState, setImportState] = useState(null)

  const envLookup = useMemo(
    () => createEnvLookup(env.activeName, env.environments, env.currentValues),
    [env.activeName, env.environments, env.currentValues],
  )

  const sendCurrent = useCallback(async () => {
    const out = await req.send(request, envLookup, {})
    if (out.ok) {
      history.push({
        method: out.result.method,
        url: out.result.url,
        status: out.result.status,
        request: JSON.parse(JSON.stringify(request)),
        environment: env.activeName,
      })
      toast.success(`Request complete (${out.result.status})`)
      if (out.missing?.length) {
        toast.warning(`Missing variable(s): ${out.missing.join(', ')}`)
      }
    } else {
      toast.error(out.error?.message || 'Request failed')
    }
  }, [req, request, envLookup, history, env.activeName])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        sendCurrent()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sendCurrent])

  const buildSavePayload = () => ({
    mode: request.mode,
    method: request.method,
    url: request.url,
    headers: request.headers,
    params: request.params,
    body: request.body,
    auth: request.auth,
    graphql: request.graphql,
    defaultEnvironment: env.activeName || '',
  })

  const saveActiveChain = () => {
    if (!chain.editingChain) return
    if (!collections.collections.length) {
      collections.createCollection('My Collection')
    }
    const options = collections.collections
    const names = options.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
    const picked = Number(window.prompt(`Save chain to which collection?\n${names}`, '1') || 1)
    const selected = options[Math.max(0, Math.min(options.length - 1, picked - 1))]
    if (!selected) return
    collections.addItem(selected.id, {
      id: uid('item'),
      type: 'chain',
      name: chain.editingChain.name || 'Chain',
      steps: chain.editingChain.steps,
      defaultEnvironment: env.activeName || '',
    })
    toast.success('Chain saved to collection')
  }

  const importCollectionFile = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseCollectionImport(String(reader.result))
        const embedded = Array.isArray(parsed.embeddedEnvironments)
          ? parsed.embeddedEnvironments
          : []
        setImportState({
          parsed,
          includeEnv: Object.fromEntries(embedded.map((e) => [e.name, true])),
          envMode: 'merge',
        })
      } catch (e) {
        toast.error(e?.message || 'Import failed')
      }
    }
    reader.readAsText(file)
  }

  const applyImportedCollection = () => {
    if (!importState) return
    const { parsed, includeEnv, envMode } = importState
    const col = collections.createCollection(parsed.name || 'Imported Collection')
    const items = parsed.items || []
    items.forEach((item) => {
      collections.addItem(col.id, { ...item, id: uid('item') })
    })

    const embedded = parsed.embeddedEnvironments || []
    embedded
      .filter((e) => includeEnv[e.name])
      .forEach((incoming) => {
        env.setEnvironments((prev) => {
          const idx = prev.findIndex((x) => x.name === incoming.name)
          if (idx === -1) {
            return [
              ...prev,
              {
                id: uid('env'),
                name: incoming.name,
                variables: incoming.variables || [],
              },
            ]
          }
          if (envMode === 'replace') {
            return prev.map((x, i) =>
              i === idx ? { ...x, variables: incoming.variables || [] } : x,
            )
          }
          const merged = [...(prev[idx].variables || [])]
          for (const v of incoming.variables || []) {
            const j = merged.findIndex((m) => m.name === v.name)
            if (j === -1) merged.push(v)
            else merged[j] = { ...merged[j], ...v }
          }
          return prev.map((x, i) => (i === idx ? { ...x, variables: merged } : x))
        })
      })

    toast.success(`Imported collection “${parsed.name}”`)
    setImportState(null)
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f0f] text-gray-100">
      <Toaster richColors position="top-right" />

      <header className="h-11 shrink-0 border-b border-gray-800 px-3 flex items-center gap-2 bg-[#111827]">
        <div className="flex items-center gap-2 mr-2" aria-label="FetchPlay">
          <PlayCircle className="w-5 h-5 text-sky-400 shrink-0" aria-hidden />
          <h1 className="text-sm font-semibold tracking-tight">FetchPlay</h1>
        </div>
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
          value={env.activeName}
          onChange={(e) => env.setActiveName(e.target.value)}
        >
          {env.environments.map((e) => (
            <option key={e.id} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowEnvManager(true)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-900"
        >
          <Globe className="w-3.5 h-3.5" />
          Environments
        </button>
        <button
          type="button"
          onClick={() => setShowAI(true)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-violet-800 text-violet-200 hover:bg-violet-950/30"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Help
        </button>
        <button
          type="button"
          onClick={() => chain.openNewChain(request)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-900"
        >
          <Link2 className="w-3.5 h-3.5" />
          New Chain
        </button>
        <div className="ml-auto text-[11px] text-gray-500">Ctrl+Enter to send</div>
      </header>

      <div className="flex-1 min-h-0">
        <Group direction="horizontal">
          <Panel defaultSize={22} minSize={16}>
            <Sidebar
              collections={collections.collections}
              createCollection={collections.createCollection}
              renameCollection={collections.renameCollection}
              deleteCollection={collections.deleteCollection}
              addItem={collections.addItem}
              removeItem={collections.removeItem}
              exportCollection={(col) =>
                collections.exportCollection(col, env.environments)
              }
              history={history.items}
              clearHistory={history.clear}
              onSelectHistory={(h) => {
                setRequest(cloneRequestLike(h.request))
                toast.success('History item restored')
              }}
              onSelectSavedRequest={(item) => {
                setRequest(cloneRequestLike(item))
                if (item.defaultEnvironment) env.setActiveName(item.defaultEnvironment)
                toast.success(`Loaded “${item.name}”`)
              }}
              onSelectChain={(item) => {
                chain.openChain(item)
              }}
              buildSavePayload={buildSavePayload}
              onImportCollectionFile={importCollectionFile}
            />
          </Panel>
          <Separator />
          <Panel defaultSize={43} minSize={30}>
            <RequestBuilder
              request={request}
              setRequest={setRequest}
              onSend={sendCurrent}
              loading={req.loading}
              activeEnvName={env.activeName}
              environments={env.environments}
              currentValues={env.currentValues}
              chainContext={{}}
            />
          </Panel>
          <Separator />
          <Panel defaultSize={35} minSize={20}>
            <ResponseViewer
              last={req.last}
              error={req.error}
              loading={req.loading}
              onRetry={sendCurrent}
              onUseInChain={() => chain.openNewChain(request)}
            />
          </Panel>
        </Group>
      </div>

      {chain.editingChain && (
        <ChainBuilder
          chain={chain.editingChain}
          setChain={chain.setEditingChain}
          onClose={chain.closeChain}
          environments={env.environments}
          activeEnvName={env.activeName}
          currentValues={env.currentValues}
          onSaveChain={saveActiveChain}
        />
      )}

      <EnvironmentManager
        open={showEnvManager}
        onClose={() => setShowEnvManager(false)}
        environments={env.environments}
        setEnvironments={env.setEnvironments}
        currentValues={env.currentValues}
        setCurrentValues={env.setCurrentValues}
        activeName={env.activeName}
        setActiveName={env.setActiveName}
        checkCircular={env.checkCircular}
      />

      <AIAssistant
        open={showAI}
        onClose={() => setShowAI(false)}
        activeResponse={req.last}
        activeError={req.error}
        onApplyRequest={(r) => {
          const next = defaultRequest()
          next.mode = r.mode || 'REST'
          next.method = r.method || 'GET'
          next.url = r.url || ''
          next.headers = Array.isArray(r.headers)
            ? r.headers.map((h) => ({
                id: uid('kv'),
                key: h.key || '',
                value: h.value || '',
                enabled: true,
              }))
            : next.headers
          if (typeof r.body === 'string') next.body = r.body
          if (r.graphql) next.graphql = { ...next.graphql, ...r.graphql }
          setRequest(next)
        }}
      />

      {importState && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#111827] border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">Import collection</h3>
            <div className="text-xs text-gray-400 mb-3">
              Also import embedded environments?
            </div>
            <div className="space-y-1 mb-3 max-h-40 overflow-auto">
              {(importState.parsed.embeddedEnvironments || []).map((e) => (
                <label key={e.name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!importState.includeEnv[e.name]}
                    onChange={(ev) =>
                      setImportState((s) => ({
                        ...s,
                        includeEnv: { ...s.includeEnv, [e.name]: ev.target.checked },
                      }))
                    }
                  />
                  <span>{e.name}</span>
                </label>
              ))}
            </div>
            <label className="text-xs text-gray-400">If environment exists:</label>
            <select
              className="mt-1 mb-4 w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm"
              value={importState.envMode}
              onChange={(e) =>
                setImportState((s) => ({ ...s, envMode: e.target.value }))
              }
            >
              <option value="merge">Merge</option>
              <option value="replace">Replace</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm text-gray-400"
                onClick={() => setImportState(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm"
                onClick={applyImportedCollection}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
