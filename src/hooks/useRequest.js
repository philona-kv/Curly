import { useCallback, useRef, useState } from 'react'
import MD5 from 'crypto-js/md5'
import { resolveTemplate } from '../utils/variableResolver'
import { tryFormatJSON } from '../utils/formatter'
import { uid } from '../utils/storage'

export function emptyKV() {
  return { id: uid('kv'), key: '', value: '', enabled: true }
}

export function defaultRequest() {
  return {
    mode: 'REST',
    method: 'GET',
    url: '',
    params: [emptyKV()],
    headers: [emptyKV()],
    body: '',
    auth: {
      type: 'none',
      bearerToken: '',
      apiKeyName: 'X-API-Key',
      apiKeyValue: '',
      apiKeyIn: 'header',
      username: '',
      password: '',
      merchantId: '',
      secretKey: '',
      userId: '',
      timestampMode: 'milliseconds',
    },
    graphql: {
      query: 'query Example {\n  __typename\n}',
      variables: '{}',
    },
    timeoutMs: 30000,
  }
}

function buildQueryString(params) {
  const usp = new URLSearchParams()
  for (const row of params || []) {
    if (!row.enabled) continue
    const k = (row.key || '').trim()
    if (!k) continue
    usp.append(k, row.value ?? '')
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

function mergeUrlWithParams(url, params) {
  const q = buildQueryString(params)
  if (!q) return url
  try {
    const u = new URL(url)
    const extra = new URLSearchParams(q.slice(1))
    extra.forEach((v, k) => u.searchParams.append(k, v))
    return u.toString()
  } catch {
    const joiner = url.includes('?') ? '&' : '?'
    return `${url}${joiner}${q.slice(1)}`
  }
}

function authHeaders(auth, resolve = (v) => v) {
  const h = {}
  if (!auth || auth.type === 'none') return h
  if (auth.type === 'bearer' && auth.bearerToken) {
    h.Authorization = `Bearer ${resolve(auth.bearerToken)}`
  }
  if (auth.type === 'basic' && auth.username != null) {
    const token = btoa(`${resolve(auth.username)}:${resolve(auth.password || '')}`)
    h.Authorization = `Basic ${token}`
  }
  if (auth.type === 'apikey' && auth.apiKeyValue) {
    if (auth.apiKeyIn === 'query') {
      return { __query: { [resolve(auth.apiKeyName || 'api_key')]: resolve(auth.apiKeyValue) } }
    }
    h[resolve(auth.apiKeyName || 'X-API-Key')] = resolve(auth.apiKeyValue)
  }
  if (auth.type === 'smarteeSignature') {
    const merchant = resolve(auth.merchantId || '')
    const secret = resolve(auth.secretKey || '')
    const user = resolve(auth.userId || '')
    const timestamp =
      auth.timestampMode === 'seconds'
        ? Math.floor(Date.now() / 1000).toString()
        : Date.now().toString()
    const sign = MD5(`${merchant}${secret}`).toString()
    const token = MD5(`${merchant}${user}${secret}${timestamp}`).toString()
    h.sign = sign
    h.user = user
    h.timestamp = timestamp
    h.token = token
  }
  return h
}

export function buildAuthQuery(auth) {
  const extra = authHeaders(auth, (v) => v)
  if (extra.__query) return extra.__query
  return {}
}

export function diagnoseVariables(request, envLookup, chainContext) {
  const parts = [
    request.url,
    request.body,
    request.graphql?.query,
    request.graphql?.variables,
    ...(request.headers || []).map((h) => h.value),
    ...(request.params || []).map((p) => p.value),
    request.auth?.bearerToken,
    request.auth?.apiKeyValue,
    request.auth?.username,
    request.auth?.password,
  ]
  for (const c of parts) {
    const r = resolveTemplate(String(c ?? ''), { envLookup, chainContext })
    if (r.circular) {
      return { circular: true, circularPath: r.circularPath, missing: [] }
    }
  }
  const urlR = resolveTemplate(String(request.url ?? ''), {
    envLookup,
    chainContext,
  })
  return {
    circular: false,
    missing: urlR.missing,
  }
}

export function compileRequest(request, envLookup, chainContext) {
  const resolve = (s) =>
    resolveTemplate(s || '', { envLookup, chainContext }).text

  const rawUrl = request.url || ''
  const resolvedParams = (request.params || []).map((row) => ({
    ...row,
    key: resolve(row.key || ''),
    value: resolve(row.value ?? ''),
  }))
  const urlWithParams = mergeUrlWithParams(rawUrl, resolvedParams)
  const resolvedUrl = resolve(urlWithParams)

  const headerRows = request.headers || []
  const headers = {}
  const auth = authHeaders(request.auth, resolve)
  let finalUrl = resolvedUrl
  if (auth.__query) {
    try {
      const u = new URL(resolvedUrl)
      Object.entries(auth.__query).forEach(([k, v]) =>
        u.searchParams.set(k, resolve(String(v))),
      )
      finalUrl = u.toString()
    } catch {
      finalUrl = resolvedUrl
    }
  } else {
    Object.assign(headers, auth)
  }

  for (const row of headerRows) {
    if (!row.enabled) continue
    const k = (row.key || '').trim()
    if (!k) continue
    headers[k] = resolve(row.value ?? '')
  }

  let method = request.method || 'GET'
  let body

  if (request.mode === 'GRAPHQL') {
    method = 'POST'
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    let variables = {}
    try {
      const vr = resolve(request.graphql?.variables || '{}')
      variables = JSON.parse(vr)
    } catch {
      variables = {}
    }
    body = JSON.stringify({
      query: resolve(request.graphql?.query || ''),
      variables,
    })
  } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const ct = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type')
    if (!ct && (request.body || '').trim()) {
      headers['Content-Type'] = 'application/json'
    }
    body = resolve(request.body || '')
  } else if ((request.body || '').trim()) {
    // GET/HEAD/… with a body (non-standard; Postman allows it — some APIs expect it)
    const ct = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type')
    if (!ct) headers['Content-Type'] = 'application/json'
    body = resolve(request.body || '')
  }

  return { url: finalUrl, headers, method, body }
}

function classifyFetchError(err) {
  const msg = err?.message || String(err)
  if (err?.name === 'AbortError') return { kind: 'timeout', message: 'Request timed out.' }
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return {
      kind: 'network',
      message:
        'Network error — often caused by CORS when the browser blocks reading the response. The server must send Access-Control-Allow-Origin. For local testing, use a public CORS-friendly API or a browser extension only in development.',
    }
  }
  return { kind: 'unknown', message: msg }
}

export async function executeCompiledFetch(compiled, timeoutMs = 30000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  const started = performance.now()
  try {
    const res = await fetch(compiled.url, {
      method: compiled.method,
      headers: compiled.headers,
      body: compiled.body,
      signal: ac.signal,
    })
    const timeMs = Math.round(performance.now() - started)
    const text = await res.text()
    let parsed = null
    const fmt = tryFormatJSON(text)
    if (fmt.ok) parsed = fmt.parsed
    const size = new Blob([text]).size
    const headersObj = {}
    res.headers.forEach((v, k) => {
      headersObj[k] = v
    })
    clearTimeout(timer)
    return {
      ok: res.ok,
      status: res.status,
      timeMs,
      size,
      headers: headersObj,
      bodyText: text,
      bodyParsed: parsed,
      url: compiled.url,
      method: compiled.method,
    }
  } catch (e) {
    clearTimeout(timer)
    throw classifyFetchError(e)
  }
}

export function useRequest() {
  const [loading, setLoading] = useState(false)
  const [last, setLast] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const send = useCallback(
    async (request, envLookup, chainContext) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      const t = request.timeoutMs || 30000
      const timer = setTimeout(() => ac.abort(), t)

      setLoading(true)
      setError(null)
      const started = performance.now()

      let compiled
      try {
        compiled = compileRequest(request, envLookup, chainContext)
      } catch (e) {
        clearTimeout(timer)
        setLoading(false)
        const err = { message: e?.message || 'Invalid request', kind: 'compile' }
        setError(err)
        setLast(null)
        return { ok: false, error: err }
      }

      const diag = diagnoseVariables(request, envLookup, chainContext)
      if (diag.circular) {
        clearTimeout(timer)
        setLoading(false)
        const err = {
          kind: 'circular',
          message: `Circular variable reference${diag.circularPath ? ` (${diag.circularPath})` : ''}`,
        }
        setError(err)
        setLast(null)
        return { ok: false, error: err }
      }

      try {
        const res = await fetch(compiled.url, {
          method: compiled.method,
          headers: compiled.headers,
          body: compiled.body,
          signal: ac.signal,
        })
        const timeMs = Math.round(performance.now() - started)
        const text = await res.text()
        let parsed = null
        const fmt = tryFormatJSON(text)
        if (fmt.ok) parsed = fmt.parsed
        const size = new Blob([text]).size
        const headersObj = {}
        res.headers.forEach((v, k) => {
          headersObj[k] = v
        })
        const out = {
          ok: res.ok,
          status: res.status,
          timeMs,
          size,
          headers: headersObj,
          bodyText: text,
          bodyParsed: parsed,
          url: compiled.url,
          method: compiled.method,
        }
        setLast(out)
        setLoading(false)
        clearTimeout(timer)
        return { ok: true, result: out, missing: diag.missing }
      } catch (e) {
        clearTimeout(timer)
        const info = classifyFetchError(e)
        setError(info)
        setLast(null)
        setLoading(false)
        return { ok: false, error: info }
      }
    },
    [],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { loading, last, error, send, cancel, setLast, setError }
}
