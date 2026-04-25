const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g

export function findPlaceholders(str) {
  if (str == null || typeof str !== 'string') return []
  const out = []
  let m
  const re = new RegExp(PLACEHOLDER_RE.source, 'g')
  while ((m = re.exec(str))) {
    out.push({ full: m[0], inner: m[1].trim() })
  }
  return out
}

function getByPath(obj, pathParts) {
  let cur = obj
  for (const p of pathParts) {
    if (cur == null) return undefined
    if (Array.isArray(cur) && (typeof p === 'number' || /^\d+$/.test(String(p)))) {
      cur = cur[Number(p)]
      continue
    }
    if (Array.isArray(cur) && typeof p === 'string' && p !== '') {
      return undefined
    }
    cur = cur[p]
  }
  return cur
}

/**
 * From e.g. "items[0].id" or "a.b.0.c" to ["items", 0, "id"] / ["a","b",0,"c"].
 */
export function parsePathSegments(pathString) {
  if (pathString == null || pathString === '') return []
  const out = []
  for (const raw of String(pathString).split('.')) {
    const part = raw.trim()
    if (!part) continue
    const bracketed = part.match(/^([^[]+)\[(\d+)\]$/)
    if (bracketed) {
      out.push(bracketed[1], Number(bracketed[2]))
      continue
    }
    if (/^\d+$/.test(part)) {
      out.push(Number(part))
    } else {
      out.push(part)
    }
  }
  return out
}

/** Parse chain ref: step1.response.body.user.id */
export function getChainRefValue(chainContext, inner) {
  const parts = inner.split('.').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 3) return undefined
  const stepId = parts[0]
  if (!/^step\d+$/i.test(stepId)) return undefined
  if (parts[1] !== 'response') return undefined
  const step = chainContext?.[stepId]
  if (!step) return undefined
  const rest = parts.slice(2)
  if (rest[0] === 'status') {
    return step.status
  }
  if (rest[0] === 'headers' && rest.length >= 2) {
    const hk = rest.slice(1).join('.').toLowerCase()
    const headers = step.headers || {}
    const found = Object.keys(headers).find((k) => k.toLowerCase() === hk)
    return found ? headers[found] : undefined
  }
  if (rest[0] === 'body') {
    const pathString = rest.slice(1).join('.')
    if (pathString === '') return step.body
    return getByPath(step.body, parsePathSegments(pathString))
  }
  return undefined
}

function getEnvVarValue(inner, envLookup) {
  if (!envLookup) return undefined
  return envLookup(inner)
}

/**
 * Resolve all {{...}} in template.
 * envLookup(inner) => value for env vars (plain NAME)
 * chainContext => { step1: { status, headers, body } }
 * Returns { text, missing: string[], circular: boolean, circularPath?: string }
 */
export function resolveTemplate(template, options = {}) {
  const { envLookup, chainContext, resolving: outerResolving } = options
  if (template == null) return { text: '', missing: [], circular: false }
  if (typeof template !== 'string') {
    return { text: String(template), missing: [], circular: false }
  }

  const resolving = outerResolving || new Set()
  const missing = []

  function lookupOne(inner) {
    if (/^step\d+\./i.test(inner)) {
      return getChainRefValue(chainContext, inner)
    }
    if (!envLookup) return undefined
    return envLookup(inner)
  }

  function resolveInner(inner, depth = 0) {
    if (depth > 64) {
      return { value: undefined, circular: true, path: inner }
    }
    if (resolving.has(inner)) {
      return { value: undefined, circular: true, path: inner }
    }
    resolving.add(inner)
    let v = lookupOne(inner)
    if (typeof v === 'string' && /\{\{[^}]+\}\}/.test(v)) {
      const sub = resolveTemplate(v, { envLookup, chainContext, resolving })
      if (sub.circular) {
        resolving.delete(inner)
        return { value: undefined, circular: true, path: sub.circularPath || inner }
      }
      v = sub.text
    }
    resolving.delete(inner)
    return { value: v, circular: false }
  }

  let circular = false
  let circularPath
  const text = template.replace(PLACEHOLDER_RE, (_, rawInner) => {
    const inner = String(rawInner).trim()
    const { value, circular: c, path } = resolveInner(inner, 0)
    if (c) {
      circular = true
      circularPath = path
      return `{{${inner}}}`
    }
    if (value === undefined || value === null) {
      missing.push(inner)
      return `{{${inner}}}`
    }
    return String(value)
  })

  return { text, missing: [...new Set(missing)], circular, circularPath }
}

/**
 * Build env lookup with priority:
 * 1. current value (active env)
 * 2. initial value (active env)
 * 3. current (Globals)
 * 4. initial (Globals)
 */
export function createEnvLookup(activeEnvName, environments, currentMap) {
  const globals = environments.find((e) => e.name === 'Globals')
  const active = environments.find((e) => e.name === activeEnvName)

  return function envLookup(varName) {
    const name = varName.trim()
    const curActive = active ? currentMap?.[active.name]?.[name] : undefined
    if (curActive !== undefined && curActive !== '') return curActive
    const initActive = active?.variables?.find((v) => v.name === name)
    if (initActive?.initialValue != null && initActive.initialValue !== '')
      return initActive.initialValue

    const curG = globals ? currentMap?.[globals.name]?.[name] : undefined
    if (curG !== undefined && curG !== '') return curG
    const initG = globals?.variables?.find((v) => v.name === name)
    if (initG?.initialValue != null && initG.initialValue !== '') return initG.initialValue

    return undefined
  }
}

export function detectCircularInValues(activeEnvName, environments, currentMap) {
  const lookup = createEnvLookup(activeEnvName, environments, currentMap)
  for (const env of environments) {
    for (const v of env.variables || []) {
      if (!v.name) continue
      const raw =
        String(currentMap?.[env.name]?.[v.name] ?? v.initialValue ?? '') + ''
      const sub = resolveTemplate(`{{${v.name}}}`, {
        envLookup: lookup,
        resolving: new Set(),
      })
      if (sub.circular) return { circular: true, path: sub.circularPath }
    }
  }
  return { circular: false }
}

/** Evaluate "run next only if previous" */
export function evaluateStepCondition(prev, condition) {
  if (!condition || !String(condition).trim()) return true
  const c = String(condition).trim()
  const mStatus = c.match(/^status\s*===?\s*(\d+)$/)
  if (mStatus) {
    return prev?.status === Number(mStatus[1])
  }
  const mBody = c.match(/^response\.body\.(.+?)\s*===?\s*(.+)$/)
  if (mBody) {
    const path = parsePathSegments(mBody[1].trim())
    let rhs = mBody[2].trim()
    let expected
    if (rhs === 'true') expected = true
    else if (rhs === 'false') expected = false
    else if (rhs === 'null') expected = null
    else if (/^-?\d+(\.\d+)?$/.test(rhs)) expected = Number(rhs)
    else if (
      (rhs.startsWith('"') && rhs.endsWith('"')) ||
      (rhs.startsWith("'") && rhs.endsWith("'"))
    ) {
      expected = rhs.slice(1, -1)
    } else expected = rhs
    const got = getByPath(prev?.body, path)
    return got === expected
  }
  return true
}
