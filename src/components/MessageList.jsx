import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Copy, RefreshCw } from 'lucide-react'
import Markdown from './Markdown.jsx'
import Logo from './Logo.jsx'

function Actions({ message, isLast, busy, onRegenerate }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }
  return (
    <div className="mt-1 flex gap-1 text-muted">
      {message.content && <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-sunk hover:text-ink">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button>}
      {isLast && !busy && <button onClick={onRegenerate} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-sunk hover:text-ink"><RefreshCw size={14} />Regenerate</button>}
    </div>
  )
}

export default function MessageList({ messages, busy, onRegenerate }) {
  const endRef = useRef(null)
  const wrapRef = useRef(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (nearBottom || messages[messages.length - 1]?.role === 'user') endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div ref={wrapRef} className="min-h-0 flex-1 overflow-y-auto">
      <ul className="mx-auto w-full max-w-3xl space-y-6 px-3 py-6 sm:px-4" aria-live="polite">
        {messages.map((m, i) => m.role === 'user' ? (
          <li key={m.id} className="flex justify-end">
            <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-md bg-sunk px-4 py-2.5">
              {m.imageUrl && <img src={m.imageUrl} alt="Image you sent" className="max-h-72 rounded-lg border border-line object-contain" />}
              {m.content && <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed">{m.content}</p>}
            </div>
          </li>
        ) : (
          <li key={m.id} className="flex gap-3">
            <div className="mt-1 shrink-0"><Logo size={26} /></div>
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3">
                {m.status === 'streaming' && !m.content
                  ? <div className="flex h-6 items-center gap-1" role="status" aria-label="Pebble is thinking"><span className="dot h-2 w-2 rounded-full bg-muted" /><span className="dot h-2 w-2 rounded-full bg-muted" /><span className="dot h-2 w-2 rounded-full bg-muted" /></div>
                  : m.content && <Markdown>{m.content}</Markdown>}
                {m.error && (
                  <p role="alert" className={`flex items-start gap-2 text-sm text-danger ${m.content ? 'mt-3 border-t border-line pt-3' : ''}`}><AlertCircle size={16} className="mt-0.5 shrink-0" />{m.error}</p>
                )}
              </div>
              {m.status !== 'streaming' && <Actions message={m} isLast={i === messages.length - 1} busy={busy} onRegenerate={onRegenerate} />}
            </div>
          </li>
        ))}
        <div ref={endRef} />
      </ul>
    </div>
  )
}
