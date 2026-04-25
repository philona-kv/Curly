import { Send } from 'lucide-react'
import KeyValueTable from './KeyValueTable'
import GraphQLEditor from './GraphQLEditor'
import VariablePreviewBar from './VariablePreviewBar'
import { createEnvLookup } from '../utils/variableResolver'
import { emptyKV } from '../hooks/useRequest'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export default function RequestBuilder({
  request,
  setRequest,
  onSend,
  loading,
  activeEnvName,
  environments,
  currentValues,
  chainContext,
}) {
  const envLookup = createEnvLookup(activeEnvName, environments, currentValues)

  const set = (patch) => setRequest((r) => ({ ...r, ...patch }))

  const defaultTab = request.mode === 'GRAPHQL' ? 'graphql' : 'params'
  const tab = request.activeTab || defaultTab

  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => set({ activeTab: id })}
      className={`px-3 py-1.5 text-sm rounded-md ${
        tab === id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  )

  const auth = request.auth || { type: 'none' }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#111827] border-r border-gray-800">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
        <div className="flex rounded-lg bg-gray-900 p-0.5">
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded-md ${
              request.mode !== 'GRAPHQL'
                ? 'bg-emerald-700 text-white'
                : 'text-gray-400'
            }`}
            onClick={() => set({ mode: 'REST', activeTab: 'params' })}
          >
            REST
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded-md ${
              request.mode === 'GRAPHQL'
                ? 'bg-violet-700 text-white'
                : 'text-gray-400'
            }`}
            onClick={() => set({ mode: 'GRAPHQL', activeTab: 'graphql' })}
          >
            GraphQL
          </button>
        </div>
        {request.mode !== 'GRAPHQL' && (
          <select
            className="bg-gray-900 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-amber-300 font-semibold"
            value={request.method}
            onChange={(e) => set({ method: e.target.value })}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {request.mode === 'GRAPHQL' && (
          <span className="text-xs text-violet-300 font-medium px-2">POST</span>
        )}
        <input
          className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-600/50"
          placeholder={
            request.mode === 'GRAPHQL'
              ? 'GraphQL endpoint URL'
              : 'https://api.example.com/resource'
          }
          value={request.url}
          onChange={(e) => set({ url: e.target.value })}
        />
        <button
          type="button"
          disabled={loading}
          onClick={onSend}
          className="inline-flex items-center gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </div>

      <VariablePreviewBar
        label="URL preview"
        template={request.url}
        envLookup={envLookup}
        chainContext={chainContext}
      />
      <div className="px-3 pt-2 shrink-0 flex flex-wrap gap-1">
        {request.mode !== 'GRAPHQL' ? (
          <>
            {tabBtn('params', 'Params')}
            {tabBtn('headers', 'Headers')}
            {tabBtn('body', 'Body')}
            {tabBtn('auth', 'Auth')}
          </>
        ) : (
          <>
            {tabBtn('headers', 'Headers')}
            {tabBtn('auth', 'Auth')}
            {tabBtn('graphql', 'Query & Variables')}
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3">
        {request.mode !== 'GRAPHQL' && tab === 'params' && (
            <KeyValueTable
              rows={request.params?.length ? request.params : [emptyKV()]}
              onChange={(rows) => set({ params: rows })}
              showToggle={false}
            />
          )}
        {tab === 'headers' && (
          <KeyValueTable
            rows={request.headers?.length ? request.headers : [emptyKV()]}
            onChange={(rows) => set({ headers: rows })}
          />
        )}
        {request.mode !== 'GRAPHQL' && tab === 'body' && (
          <div className="flex flex-col gap-2 min-h-[200px]">
            <GraphQLEditor
              variant="json"
              minHeight="220px"
              value={request.body}
              onChange={(v) => set({ body: v })}
            />
            <VariablePreviewBar
              label="Body preview"
              template={request.body}
              envLookup={envLookup}
              chainContext={chainContext}
            />
          </div>
        )}
        {tab === 'auth' && (
          <div className="flex flex-col gap-3 max-w-lg">
            <label className="text-sm text-gray-400">Type</label>
            <select
              className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
              value={auth.type}
              onChange={(e) =>
                set({ auth: { ...auth, type: e.target.value } })
              }
            >
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
              <option value="apikey">API Key</option>
              <option value="basic">Basic Auth</option>
              <option value="smarteeSignature">Merchant Signature</option>
            </select>
            {auth.type === 'bearer' && (
              <input
                className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                placeholder="Token"
                value={auth.bearerToken || ''}
                onChange={(e) =>
                  set({ auth: { ...auth, bearerToken: e.target.value } })
                }
              />
            )}
            {auth.type === 'apikey' && (
              <>
                <input
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  placeholder="Header / query name"
                  value={auth.apiKeyName || ''}
                  onChange={(e) =>
                    set({ auth: { ...auth, apiKeyName: e.target.value } })
                  }
                />
                <input
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  placeholder="Value"
                  value={auth.apiKeyValue || ''}
                  onChange={(e) =>
                    set({ auth: { ...auth, apiKeyValue: e.target.value } })
                  }
                />
                <select
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  value={auth.apiKeyIn || 'header'}
                  onChange={(e) =>
                    set({ auth: { ...auth, apiKeyIn: e.target.value } })
                  }
                >
                  <option value="header">Send in header</option>
                  <option value="query">Send in query string</option>
                </select>
              </>
            )}
            {auth.type === 'basic' && (
              <>
                <input
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  placeholder="Username"
                  value={auth.username || ''}
                  onChange={(e) =>
                    set({ auth: { ...auth, username: e.target.value } })
                  }
                />
                <input
                  type="password"
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  placeholder="Password"
                  value={auth.password || ''}
                  onChange={(e) =>
                    set({ auth: { ...auth, password: e.target.value } })
                  }
                />
              </>
            )}
            {auth.type === 'smarteeSignature' && (
              <>
                <div className="text-xs text-gray-500">
                  Generates `sign`, `user`, `timestamp`, and `token` dynamically per request.
                </div>
                <input
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  placeholder="Merchant ID (value or {{VAR}})"
                  value={auth.merchantId || ''}
                  onChange={(e) =>
                    set({ auth: { ...auth, merchantId: e.target.value } })
                  }
                />
                <input
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  placeholder="Secret Key (value or {{VAR}})"
                  value={auth.secretKey || ''}
                  onChange={(e) =>
                    set({ auth: { ...auth, secretKey: e.target.value } })
                  }
                />
                <input
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  placeholder="User ID (value or {{VAR}})"
                  value={auth.userId || ''}
                  onChange={(e) =>
                    set({ auth: { ...auth, userId: e.target.value } })
                  }
                />
                <select
                  className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
                  value={auth.timestampMode || 'milliseconds'}
                  onChange={(e) =>
                    set({ auth: { ...auth, timestampMode: e.target.value } })
                  }
                >
                  <option value="milliseconds">Timestamp: milliseconds</option>
                  <option value="seconds">Timestamp: seconds</option>
                </select>
              </>
            )}
          </div>
        )}
        {request.mode === 'GRAPHQL' && tab === 'graphql' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Query</div>
                <GraphQLEditor
                  variant="graphql"
                  minHeight="200px"
                  value={request.graphql?.query || ''}
                  onChange={(v) =>
                    set({ graphql: { ...request.graphql, query: v } })
                  }
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Variables (JSON)</div>
                <GraphQLEditor
                  variant="json"
                  minHeight="120px"
                  value={request.graphql?.variables || '{}'}
                  onChange={(v) =>
                    set({ graphql: { ...request.graphql, variables: v } })
                  }
                />
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
