import { useCallback, useEffect, useMemo, useState } from 'react'
import { KEYS, loadJSON, saveJSON, uid } from '../utils/storage'
import { detectCircularInValues } from '../utils/variableResolver'

const DEFAULT_ENVS = [
  {
    id: uid('env'),
    name: 'Globals',
    variables: [],
  },
  {
    id: uid('env'),
    name: 'Development',
    variables: [{ name: 'BASE_URL', initialValue: 'https://jsonplaceholder.typicode.com', secret: false }],
  },
]

function normalizeEnvironments(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_ENVS
  const hasGlobals = raw.some((e) => e.name === 'Globals')
  if (!hasGlobals) {
    return [{ id: uid('env'), name: 'Globals', variables: [] }, ...raw]
  }
  return raw.map((e) => ({
    ...e,
    variables: Array.isArray(e.variables) ? e.variables : [],
  }))
}

export function useEnvironments() {
  const [environments, setEnvironments] = useState(() =>
    normalizeEnvironments(loadJSON(KEYS.environments, null)),
  )
  const [currentValues, setCurrentValues] = useState(() =>
    loadJSON(KEYS.envCurrent, {}),
  )
  const [activeName, setActiveNameState] = useState(() => {
    const saved = loadJSON(KEYS.activeEnv, null)
    const list = normalizeEnvironments(loadJSON(KEYS.environments, null))
    if (saved && list.some((e) => e.name === saved)) return saved
    return list[0]?.name || 'Globals'
  })

  useEffect(() => {
    saveJSON(KEYS.environments, environments)
  }, [environments])

  useEffect(() => {
    saveJSON(KEYS.envCurrent, currentValues)
  }, [currentValues])

  useEffect(() => {
    saveJSON(KEYS.activeEnv, activeName)
  }, [activeName])

  const setActiveName = useCallback(
    (name) => {
      const exists = environments.some((e) => e.name === name)
      if (!exists && name) {
        setActiveNameState('')
        return
      }
      setActiveNameState(name || '')
    },
    [environments],
  )

  const getEnvByName = useCallback(
    (name) => environments.find((e) => e.name === name),
    [environments],
  )

  const setCurrentVar = useCallback((envName, varName, value) => {
    setCurrentValues((prev) => ({
      ...prev,
      [envName]: { ...prev[envName], [varName]: value },
    }))
  }, [])

  const clearCurrentVar = useCallback((envName, varName) => {
    setCurrentValues((prev) => {
      const next = { ...prev, [envName]: { ...prev[envName] } }
      delete next[envName][varName]
      return next
    })
  }, [])

  const addEnvironment = useCallback((name) => {
    const id = uid('env')
    setEnvironments((prev) => [...prev, { id, name, variables: [] }])
    setActiveNameState(name)
  }, [])

  const duplicateEnvironment = useCallback((env) => {
    const copyName = `${env.name} Copy`
    const id = uid('env')
    setEnvironments((prev) => [
      ...prev,
      {
        id,
        name: copyName,
        variables: (env.variables || []).map((v) => ({ ...v })),
      },
    ])
    setActiveNameState(copyName)
  }, [])

  const deleteEnvironment = useCallback(
    (envName) => {
      if (envName === 'Globals') return false
      setEnvironments((prev) => prev.filter((e) => e.name !== envName))
      setCurrentValues((prev) => {
        const next = { ...prev }
        delete next[envName]
        return next
      })
      setActiveNameState((cur) => {
        if (cur !== envName) return cur
        const rest = environments.filter((e) => e.name !== envName)
        return rest[0]?.name || ''
      })
      return true
    },
    [environments],
  )

  const updateVariables = useCallback((envName, variables) => {
    setEnvironments((prev) =>
      prev.map((e) => (e.name === envName ? { ...e, variables } : e)),
    )
  }, [])

  const renameEnvironment = useCallback((oldName, newName) => {
    if (!newName || oldName === newName) return
    setEnvironments((prev) =>
      prev.map((e) => (e.name === oldName ? { ...e, name: newName } : e)),
    )
    setCurrentValues((prev) => {
      const next = { ...prev }
      if (next[oldName]) {
        next[newName] = next[oldName]
        delete next[oldName]
      }
      return next
    })
    setActiveNameState((cur) => (cur === oldName ? newName : cur))
  }, [])

  const exportEnvironment = useCallback((env) => {
    const payload = {
      format: 'api-playground-environment',
      version: 1,
      name: env.name,
      variables: (env.variables || []).map((v) => ({
        name: v.name,
        initialValue: v.initialValue ?? '',
        secret: !!v.secret,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${env.name.replace(/[^\w.-]+/g, '_')}-environment.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [])

  const exportAllEnvironments = useCallback(() => {
    const arr = environments.map((env) => ({
      format: 'api-playground-environment',
      version: 1,
      name: env.name,
      variables: (env.variables || []).map((v) => ({
        name: v.name,
        initialValue: v.initialValue ?? '',
        secret: !!v.secret,
      })),
    }))
    const blob = new Blob([JSON.stringify(arr, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'all-environments.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }, [environments])

  const checkCircular = useCallback(() => {
    return detectCircularInValues(activeName, environments, currentValues)
  }, [activeName, environments, currentValues])

  const meta = useMemo(
    () => ({
      environments,
      currentValues,
      activeName,
      setActiveName,
      getEnvByName,
      setCurrentVar,
      clearCurrentVar,
      addEnvironment,
      duplicateEnvironment,
      deleteEnvironment,
      updateVariables,
      renameEnvironment,
      exportEnvironment,
      exportAllEnvironments,
      setEnvironments,
      setCurrentValues,
      checkCircular,
    }),
    [
      environments,
      currentValues,
      activeName,
      setActiveName,
      getEnvByName,
      setCurrentVar,
      clearCurrentVar,
      addEnvironment,
      duplicateEnvironment,
      deleteEnvironment,
      updateVariables,
      renameEnvironment,
      exportEnvironment,
      exportAllEnvironments,
      checkCircular,
    ],
  )

  return meta
}

/** Parse uploaded file: Postman vs native */
export function parseEnvironmentImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Malformed JSON — could not parse file.')
  }
  if (Array.isArray(data)) {
    return data.map((chunk, i) => normalizeImportChunk(chunk, i))
  }
  return [normalizeImportChunk(data, 0)]
}

function normalizeImportChunk(data, index) {
  if (data?.format === 'api-playground-environment' && data.name) {
    return {
      name: data.name,
      variables: (data.variables || []).map((v) => ({
        name: v.name,
        initialValue: v.initialValue ?? '',
        secret: !!v.secret,
      })),
    }
  }
  if (data?.name && Array.isArray(data.values)) {
    return {
      name: data.name,
      variables: data.values
        .filter((row) => row.enabled !== false)
        .map((row) => ({
          name: row.key,
          initialValue: row.value ?? '',
          secret: false,
        })),
    }
  }
  throw new Error(
    `Unrecognized environment format in block ${index + 1}. Use Postman export or native API Playground JSON.`,
  )
}
