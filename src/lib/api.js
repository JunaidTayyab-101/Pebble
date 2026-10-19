const MARK = '\n\n\u27e6pebble-error\u27e7'

// Streams a reply from /api/chat. Calls onText(fullTextSoFar) as chunks arrive.
export async function streamChat({ messages, token, signal, onText }) {
  let res
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
      signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  if (!res.ok) {
    let msg = `The request failed (HTTP ${res.status}).`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch {}
    if (res.status === 404) msg = 'The chat API was not found. Run the app with `npm run dev` (or `vercel dev`).'
    throw new Error(msg)
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    full += dec.decode(value, { stream: true })
    const i = full.indexOf(MARK)
    onText(i >= 0 ? full.slice(0, i) : full)
  }
  full += dec.decode()
  const i = full.indexOf(MARK)
  if (i >= 0) {
    const err = new Error(full.slice(i + MARK.length).trim() || 'The response was interrupted.')
    err.partial = full.slice(0, i)
    throw err
  }
  return full
}
