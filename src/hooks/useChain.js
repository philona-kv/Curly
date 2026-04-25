import { useCallback, useState } from 'react'
import { uid } from '../utils/storage'
import { createEnvLookup, evaluateStepCondition } from '../utils/variableResolver'
import {
  compileRequest,
  defaultRequest,
  diagnoseVariables,
  executeCompiledFetch,
} from './useRequest'

export function newChainStep(overrides = {}) {
  return {
    id: uid('step'),
    name: overrides.name || 'Step',
    onlyIfPrevious: overrides.onlyIfPrevious || '',
    environmentName: overrides.environmentName || '',
    request: overrides.request || defaultRequest(),
  }
}

export function useChain() {
  const [editingChain, setEditingChain] = useState(null)

  const openNewChain = useCallback((seedRequest) => {
    setEditingChain({
      id: uid('chain'),
      name: 'New Chain',
      steps: [
        newChainStep({
          name: 'Step 1',
          request: seedRequest
            ? JSON.parse(JSON.stringify(seedRequest))
            : defaultRequest(),
        }),
      ],
    })
  }, [])

  const openChain = useCallback((chain) => {
    setEditingChain(JSON.parse(JSON.stringify(chain)))
  }, [])

  const closeChain = useCallback(() => setEditingChain(null), [])

  return { editingChain, setEditingChain, openNewChain, openChain, closeChain }
}

/**
 * @returns {Promise<{ ok: boolean, results?: any[], error?: any, haltedAt?: number }>}
 */
export async function executeChain({
  steps,
  defaultActiveEnv,
  environments,
  currentValues,
}) {
  const chainContext = {}
  const results = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const stepKey = `step${i + 1}`

    if (i > 0) {
      const prevKey = `step${i}`
      const prevWrap = chainContext[prevKey]
      const prev = {
        status: prevWrap.status,
        body: prevWrap.body,
        headers: prevWrap.headers,
      }
      if (!evaluateStepCondition(prev, step.onlyIfPrevious)) {
        return {
          ok: false,
          haltedAt: i,
          reason: 'condition',
          results,
          chainContext,
          message: `Condition not met before ${step.name || stepKey}`,
        }
      }
    }

    const envName = step.environmentName || defaultActiveEnv || ''
    const envLookup = createEnvLookup(envName, environments, currentValues)
    const req = step.request
    const diag = diagnoseVariables(req, envLookup, chainContext)
    if (diag.circular) {
      return {
        ok: false,
        haltedAt: i,
        results,
        chainContext,
        error: {
          kind: 'circular',
          message: `Circular reference (${diag.circularPath})`,
        },
      }
    }

    let compiled
    try {
      compiled = compileRequest(req, envLookup, chainContext)
    } catch (e) {
      return {
        ok: false,
        haltedAt: i,
        results,
        chainContext,
        error: { kind: 'compile', message: e?.message || 'Compile error' },
      }
    }

    try {
      const out = await executeCompiledFetch(
        compiled,
        req.timeoutMs || 30000,
      )
      chainContext[stepKey] = {
        status: out.status,
        headers: out.headers,
        body: out.bodyParsed != null ? out.bodyParsed : out.bodyText,
      }
      results.push({ stepIndex: i, step, ok: true, response: out })
      if (!out.ok) {
        return {
          ok: false,
          haltedAt: i,
          results,
          chainContext,
          error: {
            kind: 'http',
            message: `HTTP ${out.status}`,
            response: out,
          },
        }
      }
    } catch (err) {
      results.push({ stepIndex: i, step, ok: false, error: err })
      return {
        ok: false,
        haltedAt: i,
        results,
        chainContext,
        error: err,
      }
    }
  }

  return { ok: true, results, chainContext }
}
