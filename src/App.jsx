import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import Auth from './components/Auth.jsx'
import ChatApp from './components/ChatApp.jsx'

function useTheme() {
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  const toggle = () => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try { localStorage.setItem('pebble-theme', next) } catch {}
    return next
  })
  return [theme, toggle]
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [theme, toggleTheme] = useTheme()

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) {
    return (
      <main className="grid min-h-full place-items-center px-4">
        <div role="alert" className="max-w-md text-sm">
          <h1 className="font-display text-xl font-bold">Supabase is not configured</h1>
          <p className="mt-2 text-muted">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your <code>.env</code> file, then restart <code>npm run dev</code>.</p>
        </div>
      </main>
    )
  }
  if (session === undefined) return <div className="grid h-full place-items-center text-sm text-muted" role="status">Loading…</div>
  return session ? <ChatApp key={session.user.id} session={session} theme={theme} onToggleTheme={toggleTheme} /> : <Auth />
}
