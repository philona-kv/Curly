import { useMemo, useState } from 'react'
import { X, Plus, Play, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { newChainStep } from '../hooks/useChain'
import { executeChain } from '../hooks/useChain'
import RequestBuilder from './RequestBuilder'
import { tryFormatJSON } from '../utils/formatter'

function StepResultSnippet({ response }) {
  const fmt = tryFormatJSON(response.bodyText)
  const body = fmt.ok ? fmt.text : response.bodyText
  return (
    <pre className="text-[11px] text-gray-400 whitespace-pre-wrap max-h-56 overflow-auto bg-gray-950 p-2 rounded border border-gray-800">
      {body}
    </pre>
  )
}

const CONDITIONS = [
  { value: '', label: 'Always continue' },
  { value: 'status == 200', label: 'Next if status == 200' },
  { value: 'response.body.success == true', label: 'Next if body.success == true' },
]

export default function ChainBuilder({
  chain,
  setChain,
  onClose,
  environments,
  activeEnvName,
  currentValues,
  onSaveChain,
}) {
  const [activeStep, setActiveStep] = useState(0)
  const [runResults, setRunResults] = useState(null)
  const [running, setRunning] = useState(false)

  const steps = chain.steps || []
  const step = steps[activeStep]

  const updateStep = (patch) => {
    setChain((c) => ({
      ...c,
      steps: c.steps.map((s, i) => (i === activeStep ? { ...s, ...patch } : s)),
    }))
  }

  const updateStepRequest = (updater) => {
    setChain((c) => ({
      ...c,
      steps: c.steps.map((s, i) => {
        if (i !== activeStep) return s
        const nextReq =
          typeof updater === 'function'
            ? updater(s.request)
            : { ...s.request, ...updater }
        return { ...s, request: nextReq }
      }),
    }))
  }

  const addStep = () => {
    setChain((c) => {
      const next = [
        ...c.steps,
        newChainStep({ name: `Step ${c.steps.length + 1}` }),
      ]
      setActiveStep(next.length - 1)
      return { ...c, steps: next }
    })
    toast.success('Step added')
  }

  const removeStep = (idx) => {
    if (steps.length <= 1) return
    setChain((c) => ({
      ...c,
      steps: c.steps.filter((_, i) => i !== idx),
    }))
    setActiveStep((s) => Math.max(0, s - (idx <= s ? 1 : 0)))
  }

  const run = async () => {
    setRunning(true)
    setRunResults(null)
    try {
      const out = await executeChain({
        steps,
        defaultActiveEnv: activeEnvName,
        environments,
        currentValues,
      })
      setRunResults(out)
      if (out.ok) {
        toast.success('Chain completed')
      } else {
        toast.error(out.error?.message || out.message || 'Chain halted')
      }
    } finally {
      setRunning(false)
    }
  }

  const chainContextPreview = useMemo(() => {
    const ctx = {}
    if (runResults?.chainContext) {
      Object.assign(ctx, runResults.chainContext)
    }
    // Rebuild from step results so previews work even if only step1 finished
    if (runResults?.results?.length) {
      for (const r of runResults.results) {
        if (!r?.response || r.stepIndex == null) continue
        const key = `step${r.stepIndex + 1}`
        const body =
          r.response.bodyParsed != null
            ? r.response.bodyParsed
            : r.response.bodyText
        ctx[key] = {
          status: r.response.status,
          headers: r.response.headers,
          body,
        }
      }
    }
    return ctx
  }, [runResults])

  return (
    <div className="fixed inset-0 z-40 flex bg-black/70">
      <div className="ml-auto w-full max-w-[min(100%,1280px)] h-full bg-[#0f0f0f] border-l border-gray-800 flex flex-col shadow-2xl">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
          <input
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
            value={chain.name}
            onChange={(e) => setChain((c) => ({ ...c, name: e.target.value }))}
          />
          <button
            type="button"
            onClick={addStep}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded border border-gray-700 text-gray-300 hover:bg-gray-900"
          >
            <Plus className="w-3.5 h-3.5" />
            Step
          </button>
          <button
            type="button"
            disabled={running}
            onClick={run}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-emerald-700 text-white disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            Run chain
          </button>
          <button
            type="button"
            onClick={() => onSaveChain?.()}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded border border-gray-700 text-gray-300 hover:bg-gray-900"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-800 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-gray-900 shrink-0 items-center">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveStep(i)}
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  activeStep === i
                    ? 'border-emerald-600 bg-emerald-950/40 text-emerald-200'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {s.name || `Step ${i + 1}`}
              </button>
              {i < steps.length - 1 && (
                <span className="text-gray-600 text-lg leading-none">→</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="flex-1 min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800">
            {step && (
              <>
                <div className="p-2 border-b border-gray-800 space-y-2 shrink-0">
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs flex-1 min-w-[120px]"
                      placeholder="Step name"
                      value={step.name}
                      onChange={(e) => updateStep({ name: e.target.value })}
                    />
                    <select
                      className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
                      value={step.environmentName || ''}
                      onChange={(e) =>
                        updateStep({ environmentName: e.target.value })
                      }
                    >
                      <option value="">Use active environment</option>
                      {environments.map((e) => (
                        <option key={e.id} value={e.name}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    {activeStep > 0 && (
                      <select
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs max-w-[220px]"
                        value={step.onlyIfPrevious || ''}
                        onChange={(e) =>
                          updateStep({ onlyIfPrevious: e.target.value })
                        }
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c.value || 'a'} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="p-1 text-gray-500 hover:text-red-400"
                      title="Remove step"
                      onClick={() => removeStep(activeStep)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {activeStep > 0 && (
                    <p className="text-[11px] text-amber-200/90 leading-snug bg-amber-950/30 border border-amber-900/50 rounded px-2 py-1.5">
                      <span className="font-medium">Chain paths:</span> Use{' '}
                      <code className="text-amber-100/90">{'{{step1.response.body…}}'}</code>{' '}
                      so everything after that mirrors <strong>your</strong> JSON. If the
                      top-level object has a field (e.g.{' '}
                      <code className="text-amber-100/90">data</code> or{' '}
                      <code className="text-amber-100/90">result</code>) and you need a
                      nested list item, you may use two segments with the same label as in the
                      response, e.g.{' '}
                      <code className="text-amber-100/90">
                        {'{{step1.response.body.data.items[0].id}}'}
                      </code>
                      . First <code className="text-amber-100/90">body</code> is always the
                      response body in FetchPlay; what follows is your path. If an endpoint needs a
                      JSON body, use <strong>POST</strong> (or the method the API documents)—do not
                      rely on <strong>GET</strong> with a body.
                    </p>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <RequestBuilder
                    request={step.request}
                    setRequest={(fn) => updateStepRequest(fn)}
                    onSend={() => {}}
                    loading={false}
                    activeEnvName={step.environmentName || activeEnvName}
                    environments={environments}
                    currentValues={currentValues}
                    chainContext={chainContextPreview}
                  />
                </div>
              </>
            )}
          </div>
          <div className="lg:w-[44%] min-h-[200px] flex flex-col shrink-0">
            <div className="text-xs text-gray-500 px-2 py-1 border-b border-gray-800">
              Chain results
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-2 space-y-2">
              {runResults?.results?.map((r, idx) => (
                <div
                  key={idx}
                  className="rounded border border-gray-800 p-2 text-xs space-y-1"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-300 font-medium">
                      {r.step?.name || `Step ${r.stepIndex + 1}`}
                    </span>
                    {r.response && (
                      <span
                        className={
                          r.response.status < 400
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }
                      >
                        {r.response.status}
                      </span>
                    )}
                  </div>
                  {r.response && (
                    <StepResultSnippet
                      response={r.response}
                      stepIndex={r.stepIndex}
                    />
                  )}
                  {r.error && (
                    <div className="text-red-400 whitespace-pre-wrap">
                      {r.error.message || JSON.stringify(r.error)}
                    </div>
                  )}
                </div>
              ))}
              {!runResults && (
                <div className="text-gray-600 text-sm p-2">
                  Run the chain to see each step’s response side by side.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
