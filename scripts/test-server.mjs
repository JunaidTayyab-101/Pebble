// Offline checks for the request-validation layer of api/chat.js (no internet needed).
import handler from '../api/chat.js'
process.env.VITE_SUPABASE_URL ||= 'http://127.0.0.1:9'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'sb_publishable_test'
function call(method, headers = {}, body) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, write() {}, end(b) { resolve({ status: this.statusCode, body: b }) } }
    handler({ method, headers, body }, res)
  })
}
let fail = 0
const check = (name, ok) => { console.log(ok ? 'PASS' : 'FAIL', name); if (!ok) fail++ }
check('GET -> 405', (await call('GET')).status === 405)
check('no token -> 401', (await call('POST', {}, { messages: [] })).status === 401)
check('unverifiable token -> 401', (await call('POST', { authorization: 'Bearer abc' }, { messages: [] })).status === 401)
process.exit(fail ? 1 : 0)
