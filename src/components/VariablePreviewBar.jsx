import { findPlaceholders, resolveTemplate } from '../utils/variableResolver'

function spanPreview(template, envLookup, chainContext) {
  if (template == null || template === '') {
    return <span className="text-gray-600">(empty)</span>
  }
  const s = String(template)
  const parts = []
  let last = 0
  const re = /\{\{([^}]+)\}\}/g
  let m
  while ((m = re.exec(s))) {
    if (m.index > last) {
      parts.push(
        <span key={`t-${last}`} className="text-gray-300">
          {s.slice(last, m.index)}
        </span>,
      )
    }
    const inner = m[1].trim()
    const { text, missing, circular } = resolveTemplate(`{{${inner}}}`, {
      envLookup,
      chainContext,
    })
    const resolvedOk =
      !circular && missing.length === 0 && text === String(text) && !text.includes('{{')
    parts.push(
      <span
        key={`p-${m.index}`}
        className={
          circular || missing.length
            ? 'text-red-400 underline decoration-dotted'
            : 'text-emerald-400'
        }
        title={
          circular
            ? 'Circular variable reference'
            : missing.length
              ? 'Variable not found'
              : 'Resolved'
        }
      >
        {circular || missing.length ? m[0] : text}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < s.length) {
    parts.push(
      <span key={`t-end`} className="text-gray-300">
        {s.slice(last)}
      </span>,
    )
  }
  if (parts.length === 0) {
    return <span className="text-gray-300">{s}</span>
  }
  return parts
}

export default function VariablePreviewBar({ label, template, envLookup, chainContext }) {
  const unresolved = findPlaceholders(String(template ?? '')).filter((p) => {
    const r = resolveTemplate(p.full, { envLookup, chainContext })
    return r.missing.length || r.circular
  })

  return (
    <div className="rounded-md bg-gray-900/80 border border-gray-800 px-2 py-1.5 text-xs">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
        {label}
      </div>
      <div className="font-mono break-all leading-relaxed">
        {spanPreview(template, envLookup, chainContext)}
      </div>
      {unresolved.length > 0 && (
        <div className="mt-1 text-[10px] text-red-400/90">
          Unresolved: {unresolved.map((u) => u.full).join(', ')}
        </div>
      )}
    </div>
  )
}
