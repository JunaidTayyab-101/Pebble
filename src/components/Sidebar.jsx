import { useState } from 'react'
import { Check, LogOut, Moon, PanelLeftClose, Pencil, Plus, Search, Sun, Trash2, X } from 'lucide-react'
import Logo from './Logo.jsx'

function Item({ conv, active, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(conv.title)
  const save = () => { const t = title.trim(); setEditing(false); if (t && t !== conv.title) onRename(conv.id, t.slice(0, 120)); else setTitle(conv.title) }
  if (editing) {
    return (
      <li className="flex items-center gap-1 px-1">
        <input autoFocus value={title} maxLength={120} aria-label="Conversation title" onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setTitle(conv.title) } }}
          className="min-w-0 flex-1 rounded-md border border-accent bg-surface px-2 py-1.5 text-sm outline-none" />
        <button onClick={save} aria-label="Save title" className="rounded p-1.5 text-accent hover:bg-sunk"><Check size={15} /></button>
        <button onClick={() => { setEditing(false); setTitle(conv.title) }} aria-label="Cancel rename" className="rounded p-1.5 text-muted hover:bg-sunk"><X size={15} /></button>
      </li>
    )
  }
  return (
    <li className={`group flex items-center rounded-lg ${active ? 'bg-sunk' : 'hover:bg-sunk/70'}`}>
      <button onClick={() => onSelect(conv.id)} aria-current={active ? 'page' : undefined} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm">{conv.title}</button>
      <div className="flex pr-1 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <button onClick={() => setEditing(true)} aria-label={`Rename ${conv.title}`} className="rounded p-1.5 text-muted hover:text-ink"><Pencil size={14} /></button>
        <button onClick={() => onDelete(conv)} aria-label={`Delete ${conv.title}`} className="rounded p-1.5 text-muted hover:text-danger"><Trash2 size={14} /></button>
      </div>
    </li>
  )
}

export default function Sidebar({ open, onClose, convs, loading, activeId, search, onSearch, searchRef, onNew, onSelect, onRename, onDelete, email, theme, onToggleTheme, onSignOut }) {
  const q = search.trim().toLowerCase()
  const shown = q ? convs.filter((c) => c.title.toLowerCase().includes(q)) : convs
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />}
      <aside aria-label="Conversations" inert={!open}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-bg transition-transform duration-200 md:static md:z-auto md:transition-[margin] ${open ? 'translate-x-0' : '-translate-x-full md:-ml-72 md:translate-x-0'}`}>
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="flex items-center gap-2.5"><Logo /><span className="font-display text-lg font-bold tracking-tight">Pebble</span></div>
          <button onClick={onClose} aria-label="Close sidebar" title="Close sidebar (Ctrl/⌘+B)" className="rounded-lg p-2 text-muted hover:bg-sunk hover:text-ink"><PanelLeftClose size={18} /></button>
        </div>
        <div className="space-y-2 px-3 py-2">
          <button onClick={onNew} className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-accent"><Plus size={16} />New chat</button>
          <label className="relative block">
            <span className="sr-only">Search conversations</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input ref={searchRef} value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search chats (Ctrl/⌘+K)" className="w-full rounded-lg bg-sunk py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent" />
          </label>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <h2 className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{q ? 'Results' : 'Recent'}</h2>
          {loading ? <p className="px-3 py-2 text-sm text-muted">Loading…</p>
            : shown.length === 0 ? <p className="px-3 py-2 text-sm text-muted">{q ? 'No chats match your search.' : 'No conversations yet. Start one below.'}</p>
            : <ul className="space-y-0.5">{shown.map((c) => <Item key={c.id} conv={c} active={c.id === activeId} onSelect={onSelect} onRename={onRename} onDelete={onDelete} />)}</ul>}
        </nav>
        <div className="flex items-center gap-1 border-t border-line p-3">
          <div className="min-w-0 flex-1 truncate text-xs text-muted" title={email}>{email}</div>
          <button onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="rounded-lg p-2 text-muted hover:bg-sunk hover:text-ink">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button onClick={onSignOut} aria-label="Log out" title="Log out" className="rounded-lg p-2 text-muted hover:bg-sunk hover:text-ink"><LogOut size={17} /></button>
        </div>
      </aside>
    </>
  )
}
