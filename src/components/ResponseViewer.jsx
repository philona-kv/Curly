import { useMemo, useState } from 'react'
import { Copy, Link2, RefreshCw } from 'lucide-react'
import { tryFormatJSON, formatBytes } from '../utils/formatter'
import { toast } from 'sonner'

function statusColor(status) {
  if (status == null) return 'text-gray-500'
  if (status >= 200 && status < 300) return 'text-emerald-400'
  if (status >= 400) return 'text-red-400'
  return 'text-amber-300'
}

function JsonBranch({ data, path, stepRef, onPick }) {
  if (data === null || data === undefined) {
    return (
      <span
        className="cursor-pointer hover:bg-gray-800/80 rounded px-0.5"
        onClick={() => onPick([...path])}
        title="Copy reference"
      >
        <span className="text-violet-300">{String(data)}</span>
      </span>
    )
  }
  if (typeof data !== 'object') {
    const text = JSON.stringify(data)
    return (
      <span
        className="cursor-pointer hover:bg-gray-800/80 rounded px-0.5"
        onClick={() => onPick([...path])}
        title="Copy reference"
      >
        <span className="text-amber-200">{text}</span>
      </span>
    )
  }
  if (Array.isArray(data)) {
    return (
      <span>
        <span className="text-gray-500">[</span>
        <ul className="pl-4 list-none border-l border-gray-800 my-0.5">
          {data.map((item, i) => (
            <li key={i} className="font-mono text-sm leading-relaxed">
              <span className="text-gray-600 select-none">{i}: </span>
              <JsonBranch
                data={item}
                path={[...path, i]}
                stepRef={stepRef}
                onPick={onPick}
              />
            </li>
          ))}
        </ul>
        <span className="text-gray-500">]</span>
      </span>
    )
  }
  return (
    <span>
      <span className="text-gray-500">{'{'}</span>
      <ul className="pl-4 list-none border-l border-gray-800 my-0.5">
        {Object.entries(data).map(([k, v]) => (
          <li key={k} className="font-mono text-sm leading-relaxed">
            <span
              className="text-sky-300 cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                onPick([...path, k])
              }}
            >
              {JSON.stringify(k)}
            </span>
            <span className="text-gray-500">: </span>
            <JsonBranch
              data={v}
              path={[...path, k]}
              stepRef={stepRef}
              onPick={onPick}
            />
          </li>
        ))}
      </ul>
      <span className="text-gray-500">{'}'}</span>
    </span>
  )
}

export default function ResponseViewer({
  last,
  error,
  loading,
  onRetry,
  onUseInChain,
  extractStepRef = 1,
}) {
  const [tab, setTab] = useState('pretty')

  const pretty = useMemo(() => {
    if (!last?.bodyText) return ''
    const fmt = tryFormatJSON(last.bodyText)
    return fmt.ok ? fmt.text : last.bodyText
  }, [last])

  const parsed = useMemo(() => {
    if (!last?.bodyText) return null
    const fmt = tryFormatJSON(last.bodyText)
    return fmt.ok ? fmt.parsed : null
  }, [last])

  const copyBody = async () => {
    const t = tab === 'raw' ? last?.bodyText || '' : pretty
    try {
      await navigator.clipboard.writeText(t)
      toast.success('Response copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const handlePick = (pathParts) => {
    if (!pathParts.length) return
    const bodyPath = pathParts.map((p) => String(p)).join('.')
    const ref = `{{step${extractStepRef}.response.body.${bodyPath}}}`
    navigator.clipboard.writeText(ref).then(() => {
      toast.success(`Copied reference: ${ref}`)
    })
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0f0f0f]">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-gray-800 shrink-0">
        <span className={`text-lg font-semibold ${statusColor(last?.status)}`}>
          {last ? last.status : error ? 'Error' : loading ? '…' : '—'}
        </span>
        {last && (
          <>
            <span className="text-xs text-gray-500">{last.timeMs} ms</span>
            <span className="text-xs text-gray-500">{formatBytes(last.size)}</span>
          </>
        )}
        <div className="flex-1" />
        {last && (
          <>
            <button
              type="button"
              onClick={copyBody}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-900"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            {last.ok && (
              <button
                type="button"
                onClick={() => onUseInChain?.()}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-800 text-emerald-300 hover:bg-emerald-950/40"
              >
                <Link2 className="w-3.5 h-3.5" />
                Use in Chain
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="p-3 text-sm text-red-300 bg-red-950/20 border-b border-red-900/40 shrink-0">
          <div className="font-medium mb-1">
            {error.kind === 'network' ? 'Network / CORS' : error.kind === 'timeout' ? 'Timeout' : 'Error'}
          </div>
          <div className="text-red-200/90 whitespace-pre-wrap">{error.message}</div>
          {error.kind === 'timeout' && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-800 text-gray-200 hover:bg-gray-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      )}

      <div className="flex gap-1 px-3 pt-2 shrink-0">
        {['pretty', 'raw', 'headers'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-xs rounded capitalize ${
              tab === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 text-sm">
        {loading && <div className="text-gray-500">Sending…</div>}
        {!loading && !last && !error && (
          <div className="text-gray-600">Send a request to see the response here.</div>
        )}
        {last && tab === 'pretty' && (
          <div className="font-mono text-sm overflow-x-auto">
            {parsed !== null && typeof parsed === 'object' ? (
              <JsonBranch
                data={parsed}
                path={[]}
                stepRef={extractStepRef}
                onPick={handlePick}
              />
            ) : (
              <pre className="text-gray-300 whitespace-pre-wrap">{pretty}</pre>
            )}
          </div>
        )}
        {last && tab === 'raw' && (
          <pre className="text-gray-300 whitespace-pre-wrap font-mono text-xs">{last.bodyText}</pre>
        )}
        {last && tab === 'headers' && (
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(last.headers || {}).map(([k, v]) => (
                <tr key={k} className="border-b border-gray-800">
                  <td className="py-1 pr-2 text-sky-300 align-top whitespace-nowrap">{k}</td>
                  <td className="py-1 text-gray-400 break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
