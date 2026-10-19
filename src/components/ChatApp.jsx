import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Menu, SquarePen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { streamChat } from '../lib/api'
import { EXT } from '../lib/image'
import Sidebar from './Sidebar.jsx'
import Composer from './Composer.jsx'
import MessageList from './MessageList.jsx'
import Welcome from './Welcome.jsx'

const isTemp = (id) => String(id).startsWith('tmp-')
const dbMessage = (e) => (/row-level security|permission denied/i.test(e?.message || '') ? 'You do not have access to that. Try signing in again.' : e?.message || 'Something went wrong. Please try again.')

export default function ChatApp({ session, theme, onToggleTheme }) {
  const user = session.user
  const [convs, setConvs] = useState([])
  const [convsLoading, setConvsLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const abortRef = useRef(null)
  const activeRef = useRef(null)
  const messagesRef = useRef([])
  const searchRef = useRef(null)
  const composerRef = useRef(null)
  const dragDepth = useRef(0)

  messagesRef.current = messages
  const setActive = (id) => { activeRef.current = id; setActiveId(id) }
  const isMobile = () => !window.matchMedia('(min-width: 768px)').matches
  const stop = () => abortRef.current?.abort()

  useEffect(() => {
    let live = true
    supabase.from('conversations').select('id,title,updated_at').order('updated_at', { ascending: false }).limit(200)
      .then(({ data, error }) => { if (!live) return; if (error) setNotice(dbMessage(error)); else setConvs(data); setConvsLoading(false) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setSidebarOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }
      else if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); setSidebarOpen((o) => !o) }
      else if (e.key === 'Escape' && isMobile()) setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bumpConv = (id) => setConvs((p) => { const c = p.find((x) => x.id === id); return c ? [{ ...c, updated_at: new Date().toISOString() }, ...p.filter((x) => x.id !== id)] : p })

  async function selectConv(id) {
    if (id === activeRef.current) { if (isMobile()) setSidebarOpen(false); return }
    stop(); setNotice(''); setActive(id); setMessages([]); setLoadingMsgs(true)
    if (isMobile()) setSidebarOpen(false)
    const { data, error } = await supabase.from('messages').select('id,role,content,image_path,created_at').eq('conversation_id', id).order('created_at', { ascending: true })
    if (activeRef.current !== id) return
    if (error) { setNotice(dbMessage(error)); setLoadingMsgs(false); return }
    const paths = data.filter((m) => m.image_path).map((m) => m.image_path)
    const urls = {}
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('chat-images').createSignedUrls(paths, 3600)
      signed?.forEach((s) => { if (s.signedUrl) urls[s.path] = s.signedUrl })
    }
    if (activeRef.current !== id) return
    setMessages(data.map((m) => ({ id: m.id, role: m.role, content: m.content, imagePath: m.image_path, imageUrl: m.image_path ? urls[m.image_path] : undefined })))
    setLoadingMsgs(false)
  }

  function newChat() {
    stop(); setNotice(''); setActive(null); setMessages([]); setLoadingMsgs(false)
    if (isMobile()) setSidebarOpen(false)
    setTimeout(() => composerRef.current?.focus(), 50)
  }

  async function generate(convId, history) {
    const ctl = new AbortController()
    abortRef.current = ctl
    const tempId = `tmp-${crypto.randomUUID()}`
    const isActive = () => activeRef.current === convId
    setBusy(true)
    setMessages([...history, { id: tempId, role: 'assistant', content: '', status: 'streaming' }])
    let text = ''
    let failure = null
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Your session has expired. Please sign in again.')
      await streamChat({
        token, signal: ctl.signal,
        messages: history.map((m) => ({ role: m.role, content: m.content, imagePath: m.imagePath || undefined })),
        onText: (t) => { text = t; if (isActive()) setMessages((p) => p.map((m) => (m.id === tempId ? { ...m, content: t } : m))) },
      })
    } catch (e) {
      if (e.partial != null) text = e.partial
      if (e.name !== 'AbortError') failure = e.message || 'Something went wrong.'
    }
    let savedId = null
    if (text.trim()) {
      const { data, error } = await supabase.from('messages').insert({ conversation_id: convId, role: 'assistant', content: text }).select('id').single()
      if (error) failure = failure || 'The reply could not be saved to your history.'
      else savedId = data.id
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      bumpConv(convId)
    }
    if (isActive()) {
      setMessages((p) => p.flatMap((m) => {
        if (m.id !== tempId) return [m]
        if (!text.trim()) return failure ? [{ id: tempId, role: 'assistant', content: '', status: 'error', error: failure }] : []
        return [{ id: savedId || tempId, role: 'assistant', content: text, status: failure ? 'error' : undefined, error: failure || undefined }]
      }))
    }
    if (abortRef.current === ctl) { abortRef.current = null; setBusy(false) }
  }

  async function send({ text, image }) {
    if (busy) return
    setNotice('')
    let convId = activeRef.current
    let imagePath = null
    try {
      if (!convId) {
        const title = text.trim().replace(/\s+/g, ' ').slice(0, 48) || 'Image chat'
        const { data, error } = await supabase.from('conversations').insert({ title }).select('id,title,updated_at').single()
        if (error) throw error
        convId = data.id
        setConvs((p) => [data, ...p]); setActive(convId)
      }
      if (image) {
        imagePath = `${user.id}/${crypto.randomUUID()}.${EXT[image.mime]}`
        const { error } = await supabase.storage.from('chat-images').upload(imagePath, image.blob, { contentType: image.mime, upsert: false })
        if (error) throw new Error(`Image upload failed: ${error.message}`)
      }
      const { data: row, error } = await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: text.trim(), image_path: imagePath, image_mime: image?.mime ?? null }).select('id').single()
      if (error) { if (imagePath) supabase.storage.from('chat-images').remove([imagePath]); throw error }
      const userMsg = { id: row.id, role: 'user', content: text.trim(), imagePath, imageUrl: image?.previewUrl }
      await generate(convId, [...messagesRef.current, userMsg])
    } catch (e) {
      setNotice(dbMessage(e)); setBusy(false)
      composerRef.current?.restore({ text, image })
    }
  }

  async function regenerate() {
    const last = messages[messages.length - 1]
    if (busy || !last || last.role !== 'assistant') return
    setNotice('')
    if (!isTemp(last.id)) {
      const { error } = await supabase.from('messages').delete().eq('id', last.id)
      if (error) return setNotice(dbMessage(error))
    }
    await generate(activeRef.current, messages.slice(0, -1))
  }

  async function renameConv(id, title) {
    const { error } = await supabase.from('conversations').update({ title }).eq('id', id)
    if (error) return setNotice(dbMessage(error))
    setConvs((p) => p.map((c) => (c.id === id ? { ...c, title } : c)))
  }

  async function deleteConv(conv) {
    if (!window.confirm(`Delete "${conv.title}"? This also removes its images and cannot be undone.`)) return
    const { data: imgs } = await supabase.from('messages').select('image_path').eq('conversation_id', conv.id).not('image_path', 'is', null)
    const { error } = await supabase.from('conversations').delete().eq('id', conv.id)
    if (error) return setNotice(dbMessage(error))
    if (imgs?.length) supabase.storage.from('chat-images').remove(imgs.map((i) => i.image_path))
    setConvs((p) => p.filter((c) => c.id !== conv.id))
    if (activeRef.current === conv.id) newChat()
  }

  const signOut = useCallback(async () => { stop(); await supabase.auth.signOut() }, [])

  const dragHandlers = {
    onDragEnter: (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); dragDepth.current++; setDragging(true) } },
    onDragOver: (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault() },
    onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false) },
    onDrop: (e) => { e.preventDefault(); dragDepth.current = 0; setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) composerRef.current?.addFile(f) },
  }

  const empty = !activeId && messages.length === 0

  return (
    <div className="flex h-full">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} convs={convs} loading={convsLoading} activeId={activeId}
        search={search} onSearch={setSearch} searchRef={searchRef} onNew={newChat} onSelect={selectConv} onRename={renameConv} onDelete={deleteConv}
        email={user.email} theme={theme} onToggleTheme={onToggleTheme} onSignOut={signOut} />
      <main className="relative flex min-w-0 flex-1 flex-col" {...dragHandlers}>
        <header className="flex h-14 shrink-0 items-center gap-1 px-3">
          {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" title="Open sidebar (Ctrl/⌘+B)" className="rounded-lg p-2 text-muted hover:bg-sunk hover:text-ink"><Menu size={19} /></button>}
          {!sidebarOpen && <button onClick={newChat} aria-label="New chat" className="rounded-lg p-2 text-muted hover:bg-sunk hover:text-ink"><SquarePen size={18} /></button>}
          <div className="ml-1 truncate font-display text-sm font-medium text-muted">{convs.find((c) => c.id === activeId)?.title}</div>
        </header>
        {notice && (
          <div role="alert" className="mx-auto mb-2 flex w-full max-w-3xl items-start justify-between gap-3 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger">
            <span>{notice}</span><button onClick={() => setNotice('')} className="shrink-0 underline">Dismiss</button>
          </div>
        )}
        {empty ? (
          <Welcome onPrompt={(prompt) => send({ text: prompt, image: null })} onPickImage={() => composerRef.current?.openPicker()} />
        ) : loadingMsgs ? (
          <div className="grid flex-1 place-items-center text-sm text-muted" role="status">Loading conversation…</div>
        ) : (
          <MessageList messages={messages} busy={busy} onRegenerate={regenerate} />
        )}
        <Composer ref={composerRef} busy={busy} onSend={send} onStop={stop} />
        {dragging && (
          <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-bg/85 text-center">
            <div><ImagePlus className="mx-auto text-accent" size={32} /><p className="mt-2 font-display text-lg font-medium">Drop an image to attach it</p></div>
          </div>
        )}
      </main>
    </div>
  )
}
