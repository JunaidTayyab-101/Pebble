import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ArrowUp, ImagePlus, Square, X, RefreshCw } from 'lucide-react'
import { ACCEPTED_TYPES, processImage, validateImage } from '../lib/image'

export default function Composer({ ref, busy, onSend, onStop }) {
  const [text, setText] = useState('')
  const [image, setImage] = useState(null) // { blob, mime, previewUrl }
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const taRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [text])

  async function addFile(file) {
    setError('')
    const problem = validateImage(file)
    if (problem) return setError(problem)
    setProcessing(true)
    try {
      const processed = await processImage(file)
      setImage((prev) => { if (prev) URL.revokeObjectURL(prev.previewUrl); return processed })
    } catch (e) { setError(e.message) } finally { setProcessing(false) }
  }

  useImperativeHandle(ref, () => ({
    addFile,
    openPicker: () => fileRef.current?.click(),
    focus: () => taRef.current?.focus(),
    restore: ({ text: t, image: i }) => { setText(t || ''); setImage(i || null) },
  }))

  function removeImage() {
    if (image) URL.revokeObjectURL(image.previewUrl)
    setImage(null); setError('')
  }

  const canSend = (text.trim() || image) && !busy && !processing
  function submit() {
    if (!canSend) return
    const payload = { text, image }
    setText(''); setImage(null); setError('')
    onSend(payload)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="rounded-2xl border border-line bg-surface shadow-sm focus-within:border-accent">
        {(image || processing) && (
          <div className="flex items-center gap-3 px-3 pt-3">
            {image ? <img src={image.previewUrl} alt="Attached preview" className="h-16 w-16 rounded-lg border border-line object-cover" /> : <div className="h-16 w-16 animate-pulse rounded-lg bg-sunk" />}
            <div className="flex-1 text-xs text-muted">{processing ? 'Preparing image…' : 'Image attached'}</div>
            {image && (
              <>
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-sunk hover:text-ink"><RefreshCw size={13} />Replace</button>
                <button onClick={removeImage} aria-label="Remove image" className="rounded-md p-1.5 text-muted hover:bg-sunk hover:text-ink"><X size={16} /></button>
              </>
            )}
          </div>
        )}
        <div className="flex items-end gap-1.5 p-2">
          <input ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(',')} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addFile(f) }} />
          <button onClick={() => fileRef.current?.click()} aria-label="Attach an image" title="Attach an image" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-sunk hover:text-ink"><ImagePlus size={20} /></button>
          <textarea
            ref={taRef} rows={1} value={text} maxLength={8000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
            onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); addFile(f) } }}
            placeholder={image ? 'Ask something about this image…' : 'Message Pebble'}
            aria-label="Message"
            className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-1.5 py-2 text-[0.95rem] outline-none placeholder:text-muted"
          />
          {busy ? (
            <button onClick={onStop} aria-label="Stop generating" title="Stop" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-bg"><Square size={14} fill="currentColor" /></button>
          ) : (
            <button onClick={submit} disabled={!canSend} aria-label="Send message" title="Send (Enter)" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-onaccent transition disabled:opacity-35"><ArrowUp size={20} /></button>
          )}
        </div>
      </div>
      <div className="mt-2 min-h-5 px-1 text-center text-xs text-muted">
        {error ? <span role="alert" className="text-danger">{error}</span> : 'Enter to send · Shift+Enter for a new line · Pebble can make mistakes, so check important details.'}
      </div>
    </div>
  )
}
