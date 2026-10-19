// Server-side chat endpoint. Runs as a Vercel Function in production and
// through the Vite dev middleware locally. GEMINI_API_KEY never reaches the browser.
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const MAX_MESSAGES = 30
const MAX_TEXT = 8000
const MAX_IMAGES_IN_CONTEXT = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const RATE_LIMIT = { windowMs: 60_000, max: 15 }
const ERROR_MARK = '\n\n\u27e6pebble-error\u27e7'

const SYSTEM_PROMPT = `You are Pebble, a helpful, accurate and friendly AI assistant for writing, coding, learning and everyday questions.
- Answer in clear Markdown. Use headings, lists and tables only when they make the answer easier to read. Put code in fenced blocks with a language tag.
- When the user shares an image, describe and analyse only what is actually visible. Never invent details (text, names, brands, numbers, people's identities) that you cannot reasonably determine from the image. If something is unclear, blurry or cut off, say so.
- Do not identify real people from their faces. You may describe visible appearance and context.
- Be concise by default and go deeper when asked. If you are unsure, say so rather than guessing.`

// Best-effort limiter (per server instance). For hard limits use a shared store.
const hits = new Map()
function rateLimited(key) {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE_LIMIT.windowMs)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(k)
  return recent.length > RATE_LIMIT.max
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return null } }
  return null
}

function validate(body, userId) {
  if (!body || !Array.isArray(body.messages)) return 'Request must include a messages array.'
  const msgs = body.messages
  if (msgs.length === 0 || msgs.length > 200) return 'Invalid number of messages.'
  const pathOk = new RegExp(`^${userId}/[A-Za-z0-9._-]+$`)
  for (const m of msgs) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return 'Each message needs a valid role.'
    if (typeof m.content !== 'string') return 'Each message needs text content.'
    if (m.content.length > MAX_TEXT * 5) return 'A message is too long.'
    if (m.imagePath != null) {
      if (m.role !== 'user' || typeof m.imagePath !== 'string' || !pathOk.test(m.imagePath) || m.imagePath.includes('..'))
        return 'Invalid image reference.'
    }
  }
  const last = msgs[msgs.length - 1]
  if (last.role !== 'user') return 'The last message must come from the user.'
  if (!last.content.trim() && !last.imagePath) return 'Send some text or an image.'
  if (last.content.length > MAX_TEXT) return `Messages are limited to ${MAX_TEXT} characters.`
  return null
}

async function loadImage(supabase, path) {
  const { data, error } = await supabase.storage.from('chat-images').download(path)
  if (error || !data) throw Object.assign(new Error('Could not load an attached image.'), { status: 404 })
  if (data.size > MAX_IMAGE_BYTES) throw Object.assign(new Error('An attached image is too large.'), { status: 413 })
  const mime = ALLOWED_MIME.includes(data.type) ? data.type : null
  if (!mime) throw Object.assign(new Error('Unsupported image type.'), { status: 415 })
  return { mimeType: mime, data: Buffer.from(await data.arrayBuffer()).toString('base64') }
}

async function buildContents(supabase, messages) {
  const recent = messages.slice(-MAX_MESSAGES)
  // Keep only the newest few images; older ones are replaced by a text note.
  const withImg = recent.map((m, i) => (m.imagePath ? i : -1)).filter((i) => i >= 0)
  const keep = new Set(withImg.slice(-MAX_IMAGES_IN_CONTEXT))
  const contents = []
  for (let i = 0; i < recent.length; i++) {
    const m = recent[i]
    const parts = []
    if (m.imagePath && keep.has(i)) parts.push({ inlineData: await loadImage(supabase, m.imagePath) })
    else if (m.imagePath) parts.push({ text: '[An earlier image was shared here but is no longer available.]' })
    if (m.content.trim()) parts.push({ text: m.content })
    if (!parts.length) continue
    if (m.role === 'user' && m.imagePath && !m.content.trim()) parts.push({ text: 'Please describe this image.' })
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts })
  }
  return contents
}

function friendly(err) {
  const status = err?.status || err?.code
  const msg = String(err?.message || '')
  if (status === 429) return [429, 'The AI service is busy or its quota is used up. Please try again shortly.']
  if (status === 400 && /API key|API_KEY/i.test(msg)) return [502, 'The server\'s Gemini API key is invalid. Check GEMINI_API_KEY.']
  if (status === 401 || status === 403) return [502, 'The AI service rejected the server\'s credentials. Check GEMINI_API_KEY.']
  if (status === 404) return [502, `The configured Gemini model (${MODEL}) was not found. Check GEMINI_MODEL.`]
  if (status === 400) return [400, 'The AI service could not process that request (for example, an unsupported image).']
  if (status >= 500) return [502, 'The AI service is temporarily unavailable. Please try again.']
  return [err?.status && err.status < 500 ? err.status : 500, err?.status ? 'The request failed. Please try again.' : msg || 'Something went wrong.']
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }) }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) return json(res, 500, { error: 'Server is missing Supabase environment variables.' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(res, 401, { error: 'Please sign in to chat.' })

  // The caller's JWT is forwarded so Storage/RLS checks run as that user.
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData?.user) return json(res, 401, { error: 'Your session has expired. Please sign in again.' })
  const user = userData.user

  if (rateLimited(user.id)) return json(res, 429, { error: 'Too many requests. Please wait a minute and try again.' })

  const body = readBody(req)
  const problem = validate(body, user.id)
  if (problem) return json(res, 400, { error: problem })

  if (!process.env.GEMINI_API_KEY) return json(res, 500, { error: 'Server is missing GEMINI_API_KEY. Add it to your environment and restart.' })

  let started = false
  try {
    const contents = await buildContents(supabase, body.messages)
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 4096 },
    })
    let blockReason = null
    for await (const chunk of stream) {
      blockReason = chunk.promptFeedback?.blockReason || blockReason
      const text = chunk.text
      if (!text) continue
      if (!started) {
        started = true
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store, no-transform')
        res.setHeader('X-Accel-Buffering', 'no')
      }
      res.write(text)
    }
    if (!started) return json(res, 502, { error: blockReason ? 'The request was blocked by the AI safety filters. Try rephrasing.' : 'The AI returned an empty response. Please try again.' })
    res.end()
  } catch (err) {
    console.error('[api/chat]', err?.status || '', err?.message || err)
    const [status, message] = friendly(err)
    if (!started) return json(res, status, { error: message })
    res.write(ERROR_MARK + message)
    res.end()
  }
}
