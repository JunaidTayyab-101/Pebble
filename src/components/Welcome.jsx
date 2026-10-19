import { Code2, Image as ImageIcon, Lightbulb, PenLine } from 'lucide-react'
import Logo from './Logo.jsx'

const CARDS = [
  { icon: Lightbulb, title: 'Explain something', hint: 'Break down a tricky idea', prompt: 'Explain how vaccines train the immune system, in plain language with a simple analogy.' },
  { icon: PenLine, title: 'Draft a message', hint: 'Emails, posts, cover letters', prompt: 'Help me write a polite email asking my landlord to fix a leaking tap. Keep it short and firm.' },
  { icon: Code2, title: 'Work through code', hint: 'Write, debug or review', prompt: 'Write a JavaScript function that debounces another function, then explain how it works.' },
  { icon: ImageIcon, title: 'Understand an image', hint: 'Upload a photo or screenshot', image: true },
]

export default function Welcome({ onPrompt, onPickImage }) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
      <Logo size={48} />
      <h1 className="mt-5 text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">What can I help with?</h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted">Ask a question, paste some code, or attach an image and ask about it.</p>
      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        {CARDS.map(({ icon: Icon, title, hint, prompt, image }) => (
          <button key={title} onClick={() => (image ? onPickImage() : onPrompt(prompt))} className="rounded-xl border border-line bg-surface p-4 text-left transition hover:border-accent">
            <Icon size={18} className="text-accent" />
            <div className="mt-2 text-sm font-semibold">{title}</div>
            <div className="mt-0.5 text-xs text-muted">{hint}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
