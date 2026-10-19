# Pebble: AI chat with text + image understanding

React + Vite + Tailwind CSS v4 · Supabase (auth, Postgres, private Storage) · Google Gemini (server-side).

## 1. Install and run locally

```bash
npm install
# .env is already created. Open it and paste your NEW key after GEMINI_API_KEY=
npm run dev          # http://localhost:5173  (frontend + /api/chat in one process)
```

`.env` (git-ignored) holds:

| Variable | Where it is used |
|---|---|
| `VITE_SUPABASE_URL` | browser + server (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser + server (public, protected by RLS) |
| `GEMINI_API_KEY` | **server only** (`api/chat.js`). Never prefix with `VITE_` |
| `GEMINI_MODEL` | optional, default `gemini-2.5-flash` (text + image input) |

Never put a Supabase secret / `service_role` key anywhere in this project; it is not needed.

## 2. Database setup (one time)

Apply `supabase/migrations/20261017000000_init_chat.sql` using either method:

**A. Dashboard (simplest):** Supabase → SQL Editor → New query → paste the whole file → Run.

**B. CLI:**
```bash
npx supabase login
npx supabase link --project-ref htijastqroukuujtjvhc
npx supabase db push
```

It creates `conversations`, `messages`, RLS policies (owner-only), and a **private** `chat-images` bucket
(5 MB, JPG/PNG/WebP/GIF) whose policies only allow access to the `<user_id>/` folder.

Then in Supabase → Authentication → Providers, make sure **Email** is enabled. For quick local testing you may
turn off "Confirm email"; otherwise new users must click the confirmation link first.

## 3. Deploy to Vercel (later, no code changes)

1. Push to GitHub (`.env` is ignored).
2. Vercel → Add New Project → import the repo (framework: Vite; `vercel.json` is already included).
3. Project → Settings → Environment Variables, add for Production and Preview:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL`.
4. Deploy. Then in Supabase → Authentication → URL Configuration set **Site URL** to your Vercel URL and add it to Redirect URLs.

`npm run preview` serves only the static build (no `/api`). Use `npm run dev`, or `vercel dev` to emulate production.

## 4. Features and shortcuts

Enter sends · Shift+Enter new line · Ctrl/⌘+K search · Ctrl/⌘+B toggle sidebar · paste or drag an image into the composer.
Images are resized in the browser (max 1568 px), stored privately, and re-sent to Gemini for follow-up questions (newest 4 images per request).

## 5. Limits and notes

- Server limits: 15 requests/minute per user (in-memory, per serverless instance; use a shared store for strict limits), 8,000 characters per message, last 30 messages sent as context.
- Conversation search matches titles only.
- `npm run test:server` runs offline checks of the API auth gate (no internet needed).
