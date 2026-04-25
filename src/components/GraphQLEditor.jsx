import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

export default function GraphQLEditor({
  value,
  onChange,
  minHeight = '160px',
  variant = 'json',
}) {
  const ext = variant === 'graphql' ? javascript() : json()
  return (
    <CodeMirror
      value={value}
      height={minHeight}
      theme={oneDark}
      extensions={[ext]}
      onChange={onChange}
      className="rounded-md overflow-hidden border border-gray-700"
      basicSetup={{ lineNumbers: true, foldGutter: true }}
    />
  )
}
