export function tryFormatJSON(text) {
  if (text == null || text === '') return { ok: true, text: '', parsed: null }
  const trimmed = String(text).trim()
  if (!trimmed) return { ok: true, text: '', parsed: null }
  try {
    const parsed = JSON.parse(trimmed)
    return {
      ok: true,
      text: JSON.stringify(parsed, null, 2),
      parsed,
    }
  } catch {
    return { ok: false, text: String(text), parsed: null }
  }
}

export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '0 KB'
  const kb = bytes / 1024
  return `${kb < 0.01 ? kb.toFixed(4) : kb.toFixed(2)} KB`
}

export function headersToObject(headers) {
  const o = {}
  if (!headers) return o
  if (typeof headers.forEach === 'function') {
    headers.forEach((v, k) => {
      o[k] = v
    })
    return o
  }
  return { ...headers }
}

export function objectToHeaderEntries(obj) {
  return Object.entries(obj || {}).map(([key, value]) => ({
    key,
    value: String(value ?? ''),
  }))
}
