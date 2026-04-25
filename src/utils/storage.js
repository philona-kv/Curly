const PREFIX = ''

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function removeKey(key) {
  localStorage.removeItem(key)
}

export const KEYS = {
  collections: 'api_playground_collections',
  history: 'api_playground_history',
  environments: 'api_playground_environments',
  envCurrent: 'api_playground_env_current',
  activeEnv: 'api_playground_active_env',
  aiKey: 'api_playground_ai_key',
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`
}
