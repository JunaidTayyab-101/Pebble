import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Logo from './Logo.jsx'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        if (!data.session) setInfo('Account created. Check your email for a confirmation link, then sign in.')
      }
    } catch (err) {
      const m = err.message || 'Something went wrong.'
      setError(/invalid login/i.test(m) ? 'Incorrect email or password.' : /fetch|network/i.test(m) ? 'Could not reach Supabase. Check your connection and project URL.' : m)
    } finally { setBusy(false) }
  }

  const input = 'w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent'
  return (
    <main className="grid min-h-full place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3"><Logo size={36} /><span className="font-display text-2xl font-bold tracking-tight">Pebble</span></div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-2 text-sm text-muted">{mode === 'signin' ? 'Sign in to pick up your conversations.' : 'Your chats are private and saved to your account.'}</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block text-sm font-medium">Email
            <input className={`${input} mt-1.5 font-normal`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Password
            <input className={`${input} mt-1.5 font-normal`} type="password" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {info && <p role="status" className="text-sm text-accent">{info}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-onaccent transition hover:opacity-90 disabled:opacity-60">
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="mt-5 text-sm text-muted">
          {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
          <button className="font-medium text-accent underline-offset-2 hover:underline" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}>
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  )
}
