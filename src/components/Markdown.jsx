import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'

const textOf = (n) => (typeof n === 'string' ? n : Array.isArray(n) ? n.map(textOf).join('') : n?.props ? textOf(n.props.children) : '')

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false)
  const code = children?.props
  const lang = /language-([\w-]+)/.exec(code?.className || '')?.[1] || 'text'
  const copy = async () => {
    try { await navigator.clipboard.writeText(textOf(code?.children).replace(/\n$/, '')); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  return (
    <div className="codeblock not-prose my-4 overflow-hidden rounded-xl border border-line bg-[#0d1512]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-1.5 text-xs text-white/60">
        <span className="font-mono">{lang}</span>
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-white/10 hover:text-white" aria-label="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

export default function Markdown({ children }) {
  return (
    <div className="prose prose-neutral max-w-none break-words text-[0.95rem] leading-relaxed dark:prose-invert prose-headings:font-display prose-a:text-accent prose-code:rounded prose-code:bg-sunk prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.85em] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-table:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          img: () => null,
          table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
