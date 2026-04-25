import { useState } from 'react'
import { X, Sparkles, Send } from 'lucide-react'
import { toast } from 'sonner'
import { KEYS, loadJSON, saveJSON } from '../utils/storage'

function buildSystemPrompt() {
  return `You are an API request assistant.
Return strict JSON only, no markdown.
When the user asks to create a request, produce:
{
  "action": "build_request",
  "request": {
    "mode": "REST" | "GRAPHQL",
    "method": "GET|POST|PUT|PATCH|DELETE",
    "url": "https://...",
    "headers": [{"key":"Content-Type","value":"application/json"}],
    "body": "raw body string",
    "graphql": { "query": "...", "variables": "{}" }
  }
}
When user asks to explain a response, produce:
{
  "action":"explain_response",
  "explanation":"plain english explanation"
}
When user asks to debug an error, produce:
{
  "action":"debug_error",
  "suggestions":["tip 1","tip 2"]
}`
}

async function callClaude({ apiKey, userPrompt, responseContext, errorContext }) {
  const endpoint = 'https://api.anthropic.com/v1/messages'
  const prompt = [
    userPrompt,
    responseContext
      ? `\nCurrent response context:\n${JSON.stringify(responseContext).slice(0, 12000)}`
      : '',
    errorContext ? `\nCurrent error context:\n${JSON.stringify(errorContext)}` : '',
  ].join('\n')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = data?.content?.find((c) => c.type === 'text')?.text || ''
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('AI returned invalid JSON format')
  }
  return parsed
}

export default function AIAssistant({
  open,
  onClose,
  onApplyRequest,
  activeResponse,
  activeError,
}) {
  const [apiKey, setApiKey] = useState(() => loadJSON(KEYS.aiKey, ''))
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])

  if (!open) return null

  const submit = async () => {
    if (!apiKey) {
      toast.error('Enter your Claude API key first')
      return
    }
    if (!prompt.trim()) return
    saveJSON(KEYS.aiKey, apiKey)
    const userText = prompt.trim()
    setPrompt('')
    setMessages((m) => [...m, { role: 'user', text: userText }])
    setLoading(true)
    try {
      const out = await callClaude({
        apiKey,
        userPrompt: userText,
        responseContext: activeResponse,
        errorContext: activeError,
      })
      if (out.action === 'build_request' && out.request) {
        onApplyRequest?.(out.request)
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: 'I prepared a request and applied it.' },
        ])
        toast.success('Applied request from AI')
      } else if (out.action === 'explain_response') {
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: out.explanation || 'No explanation returned.' },
        ])
      } else if (out.action === 'debug_error') {
        const t = Array.isArray(out.suggestions)
          ? out.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
          : 'No suggestions returned.'
        setMessages((m) => [...m, { role: 'assistant', text: t }])
      } else {
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: JSON.stringify(out, null, 2) },
        ])
      }
    } catch (e) {
      toast.error(e?.message || 'AI request failed')
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Error: ${e?.message || 'Unknown error'}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex">
      <div className="ml-auto h-full w-full max-w-xl bg-[#111827] border-l border-gray-800 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold">AI Help</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-800 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-gray-800">
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-xs"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Claude API key (stored in localStorage)"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-sm text-gray-500">
              Try: “GET all posts from JSONPlaceholder”, “explain this response”, or
              “debug this error”.
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded p-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-gray-900 text-gray-200'
                  : 'bg-violet-950/30 border border-violet-900/40 text-violet-100'
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-800 flex gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm min-h-20"
            placeholder="Ask AI to build a request, explain response, or debug error."
          />
          <button
            type="button"
            disabled={loading}
            onClick={submit}
            className="self-end inline-flex items-center gap-1 bg-violet-700 hover:bg-violet-600 disabled:opacity-60 text-white text-sm px-3 py-2 rounded"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Thinking…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
