import { useCallback, useEffect, useState } from 'react'
import { KEYS, loadJSON, saveJSON, uid } from '../utils/storage'

function normalizeCollections(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((c) => ({
    id: c.id || uid('col'),
    name: c.name || 'Untitled',
    items: Array.isArray(c.items) ? c.items : [],
  }))
}

export function useCollections() {
  const [collections, setCollections] = useState(() =>
    normalizeCollections(loadJSON(KEYS.collections, [])),
  )

  useEffect(() => {
    saveJSON(KEYS.collections, collections)
  }, [collections])

  const createCollection = useCallback((name) => {
    const col = { id: uid('col'), name: name || 'New Collection', items: [] }
    setCollections((prev) => [...prev, col])
    return col
  }, [])

  const renameCollection = useCallback((id, name) => {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
    )
  }, [])

  const deleteCollection = useCallback((id) => {
    setCollections((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const addItem = useCallback((collectionId, item) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? { ...c, items: [...c.items, { ...item, id: item.id || uid('item') }] }
          : c,
      ),
    )
  }, [])

  const removeItem = useCallback((collectionId, itemId) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
          : c,
      ),
    )
  }, [])

  const updateItem = useCallback((collectionId, itemId, patch) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              items: c.items.map((i) =>
                i.id === itemId ? { ...i, ...patch } : i,
              ),
            }
          : c,
      ),
    )
  }, [])

  const exportCollection = useCallback((collection, embeddedEnvironments = []) => {
    const payload = {
      format: 'api-playground-collection',
      version: 1,
      name: collection.name,
      embeddedEnvironments: embeddedEnvironments.map((env) => ({
        name: env.name,
        variables: (env.variables || []).map((v) => ({
          name: v.name,
          initialValue: v.initialValue ?? '',
          secret: !!v.secret,
        })),
      })),
      items: collection.items.map((item) => {
        const base = {
          type: item.type || 'request',
          name: item.name,
          defaultEnvironment: item.defaultEnvironment || '',
        }
        if (item.type === 'chain') {
          return {
            ...base,
            steps: item.steps,
          }
        }
        return {
          ...base,
          mode: item.mode,
          method: item.method,
          url: item.url,
          params: item.params,
          headers: item.headers,
          body: item.body,
          auth: item.auth,
          graphql: item.graphql,
        }
      }),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${collection.name.replace(/[^\w.-]+/g, '_')}-collection.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [])

  return {
    collections,
    setCollections,
    createCollection,
    renameCollection,
    deleteCollection,
    addItem,
    removeItem,
    updateItem,
    exportCollection,
  }
}

export function parseCollectionImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Malformed JSON — could not parse collection file.')
  }

  // Native app export
  if (data?.format === 'api-playground-collection' && Array.isArray(data.items)) {
    return normalizeImportedCollection(data)
  }

  // Postman Collection v2.1 import
  if (Array.isArray(data?.item) && data?.info) {
    return normalizeImportedCollection(convertPostmanCollection(data))
  }

  throw new Error(
    'Collection format not supported. Use a FetchPlay export JSON or Postman Collection v2.1 JSON.',
  )
}

function normalizeKV(rows) {
  const source = Array.isArray(rows) ? rows : []
  if (!source.length) {
    return [{ id: uid('kv'), key: '', value: '', enabled: true }]
  }
  return source.map((row) => ({
    id: row.id || uid('kv'),
    key: row.key || '',
    value: row.value ?? '',
    enabled: row.enabled !== false,
  }))
}

function normalizeImportedCollection(data) {
  return {
    ...data,
    embeddedEnvironments: Array.isArray(data.embeddedEnvironments)
      ? data.embeddedEnvironments
      : [],
    items: (data.items || []).map((item) => {
      if (item.type === 'chain') {
        return {
          ...item,
          id: item.id || uid('item'),
        }
      }
      return {
        ...item,
        id: item.id || uid('item'),
        mode: item.mode || 'REST',
        method: item.method || 'GET',
        headers: normalizeKV(item.headers),
        params: normalizeKV(item.params),
        body: item.body || '',
        auth: item.auth || {
          type: 'none',
          bearerToken: '',
          apiKeyName: 'X-API-Key',
          apiKeyValue: '',
          apiKeyIn: 'header',
          username: '',
          password: '',
        },
        graphql: {
          query: item.graphql?.query || 'query Example {\n  __typename\n}',
          variables: item.graphql?.variables || '{}',
        },
      }
    }),
  }
}

function normalizePostmanUrl(url, queryRows = []) {
  if (!url) return ''
  if (typeof url === 'string') return url
  if (typeof url.raw === 'string' && url.raw.trim()) return url.raw
  const protocol = url.protocol ? `${url.protocol}://` : ''
  const host = Array.isArray(url.host) ? url.host.join('.') : ''
  const path = Array.isArray(url.path) ? `/${url.path.join('/')}` : ''
  const q = Array.isArray(queryRows) && queryRows.length
    ? `?${queryRows
        .filter((row) => row?.disabled !== true && row?.key)
        .map(
          (row) =>
            `${encodeURIComponent(row.key)}=${encodeURIComponent(row.value ?? '')}`,
        )
        .join('&')}`
    : ''
  return `${protocol}${host}${path}${q}`
}

function flattenPostmanItems(items, out = []) {
  for (const item of items || []) {
    if (item?.request) {
      out.push(item)
    }
    if (Array.isArray(item?.item)) {
      flattenPostmanItems(item.item, out)
    }
  }
  return out
}

function getEventScriptText(events) {
  return (events || [])
    .filter((e) => e?.listen === 'prerequest')
    .flatMap((e) => e?.script?.exec || [])
    .join('\n')
}

function parseSignatureAuthFromEvents(events) {
  const text = getEventScriptText(events)
  if (!text) return null
  if (!/CryptoJS\.MD5/.test(text)) return null
  if (!/key:\s*'sign'/.test(text) || !/key:\s*'token'/.test(text)) return null

  const signLine = text.match(/const\s+sign\s*=\s*CryptoJS\.MD5\(`([^`]+)`\)/)
  const tokenLine = text.match(/const\s+token\s*=\s*CryptoJS\.MD5\(`([^`]+)`\)/)
  if (!signLine || !tokenLine) return null

  const extractVars = (line) => {
    const vars = []
    const re = /pm\.variables\.get\('([^']+)'\)/g
    let m
    while ((m = re.exec(line))) vars.push(m[1])
    return vars
  }

  const signVars = extractVars(signLine[1])
  const tokenVars = extractVars(tokenLine[1])
  if (signVars.length < 2 || tokenVars.length < 3) return null

  const userHeaderVar =
    text.match(/key:\s*'user'[\s\S]*?pm\.variables\.get\('([^']+)'\)/)?.[1] ||
    tokenVars[1]

  const secondsMode = /Math\.floor\(Date\.now\(\)\s*\/\s*1000\)/.test(text)

  return {
    type: 'smarteeSignature',
    merchantId: `{{${tokenVars[0]}}}`,
    secretKey: `{{${signVars[1]}}}`,
    userId: `{{${userHeaderVar}}}`,
    timestampMode: secondsMode ? 'seconds' : 'milliseconds',
  }
}

function convertPostmanRequest(pmItem, inheritedAuth = null) {
  const req = pmItem.request || {}
  const method = (req.method || 'GET').toUpperCase()
  const headerRows = Array.isArray(req.header)
    ? req.header.map((h) => ({
        id: uid('kv'),
        key: h?.key || '',
        value: h?.value || '',
        enabled: h?.disabled !== true,
      }))
    : []

  const queryRows = Array.isArray(req?.url?.query)
    ? req.url.query
        .filter((q) => q?.disabled !== true)
        .map((q) => ({
          id: uid('kv'),
          key: q?.key || '',
          value: q?.value || '',
          enabled: true,
        }))
    : []

  const url = normalizePostmanUrl(req.url, queryRows)
  const bodyMode = req?.body?.mode
  const isGraphQL = bodyMode === 'graphql'
  const bodyRaw = typeof req?.body?.raw === 'string' ? req.body.raw : ''
  const ownAuth = parseSignatureAuthFromEvents(pmItem.event || [])
  const derivedAuth = ownAuth || inheritedAuth

  let graphql = {
    query: 'query Example {\n  __typename\n}',
    variables: '{}',
  }

  if (isGraphQL) {
    const g = req?.body?.graphql || {}
    graphql = {
      query: g.query || '',
      variables:
        typeof g.variables === 'string'
          ? g.variables
          : JSON.stringify(g.variables || {}, null, 2),
    }
  }

  return {
    type: 'request',
    name: pmItem?.name || `${method} ${url || 'request'}`,
    mode: isGraphQL ? 'GRAPHQL' : 'REST',
    method: isGraphQL ? 'POST' : method,
    url,
    params: queryRows.length
      ? queryRows
      : [{ id: uid('kv'), key: '', value: '', enabled: true }],
    headers: (derivedAuth
      ? headerRows.filter(
          (h) => !['sign', 'user', 'timestamp', 'token'].includes((h.key || '').toLowerCase()),
        )
      : headerRows
    ).length
      ? (derivedAuth
          ? headerRows.filter(
              (h) => !['sign', 'user', 'timestamp', 'token'].includes((h.key || '').toLowerCase()),
            )
          : headerRows)
      : [{ id: uid('kv'), key: '', value: '', enabled: true }],
    body: isGraphQL ? '' : bodyRaw,
    auth:
      derivedAuth ||
      {
        type: 'none',
        bearerToken: '',
        apiKeyName: 'X-API-Key',
        apiKeyValue: '',
        apiKeyIn: 'header',
        username: '',
        password: '',
      },
    graphql,
    defaultEnvironment: '',
  }
}

function convertPostmanCollection(data) {
  const flat = flattenPostmanItems(data.item)
  const collectionAuth = parseSignatureAuthFromEvents(data.event || [])
  const items = flat.map((item) => convertPostmanRequest(item, collectionAuth))
  return {
    format: 'api-playground-collection',
    version: 1,
    name: data?.info?.name || 'Imported Postman Collection',
    embeddedEnvironments: [],
    items,
  }
}
