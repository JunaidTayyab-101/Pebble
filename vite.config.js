import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local dev: serves /api/chat from the same handler Vercel runs in production,
// so no source changes are needed when you deploy.
function localApi(env) {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        // Make server-only variables (GEMINI_API_KEY etc.) visible to the handler.
        for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = Buffer.concat(chunks).toString('utf8')
        try { req.body = raw ? JSON.parse(raw) : {} } catch { req.body = null }
        const { default: handler } = await server.ssrLoadModule('/api/chat.js')
        await handler(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), tailwindcss(), localApi(env)] }
})
