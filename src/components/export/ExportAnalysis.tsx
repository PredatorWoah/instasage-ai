'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Check, Copy, Download, ExternalLink, Share2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Goal = 'plan' | 'review' | 'ideas' | 'ask';

const GOALS: { id: Goal; title: string; blurb: string }[] = [
  { id: 'plan', title: '30-day game plan', blurb: 'Keep and stop lists, pillars, schedule, 4 weeks of posts, experiments, targets' },
  { id: 'review', title: 'What works and what does not', blurb: '5 insights with numbers, plus 6 quick wins' },
  { id: 'ideas', title: 'Brainstorm with me', blurb: '10 post ideas with hooks, then a question to go deeper' },
  { id: 'ask', title: 'Ask my own question', blurb: 'Just the data and instructions to answer you (add your question at the end)' },
];

const CHATS = [
  { label: 'Open Claude', href: 'https://claude.ai/new' },
  { label: 'Open ChatGPT', href: 'https://chatgpt.com/' },
  { label: 'Open Gemini', href: 'https://gemini.google.com/app' },
];

// Copies InstaSage's worked-out numbers plus ready-made instructions, to paste into ChatGPT,
// Claude, Gemini or any chat app (free or subscription plans, no API needed)
export function ExportAnalysis({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<Goal>('plan');
  const [text, setText] = useState('');
  const [tokens, setTokens] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Opening the panel, or choosing another goal, builds fresh text from your latest numbers
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/export/analysis?goal=${goal}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({ error: 'Could not build the export.' })) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        setText(ok ? data.text : '');
        setTokens(ok ? data.tokens : 0);
        setError(ok ? null : data.error);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not reach the server.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, goal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const choose = (g: Goal) => {
    if (g === goal) return;
    setLoading(true);
    setText('');
    setGoal(g);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Locked down browsers: select the preview so Ctrl+C works
      const box = document.getElementById('export-preview') as HTMLTextAreaElement | null;
      box?.focus();
      box?.select();
      return toast.error('Could not copy automatically', { description: 'The text is selected, press Ctrl+C (or Cmd+C).' });
    }
    setCopied(true);
    toast.success('Copied', { description: 'Now paste it into a new ChatGPT, Claude or Gemini chat.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `instasage-${goal}-export.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoading(true);
          setOpen(true);
        }}
        className={cn('inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[13px] font-bold hover:bg-ink/[0.12] transition-colors shrink-0', className)}
      >
        <Share2 className="w-4 h-4" /> Export for ChatGPT or Claude
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Export your analysis">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-[6px] animate-[fade-in_200ms_ease-out_both]" />
          <div className="acrylic-panel relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-[30px] sm:rounded-[30px] p-5 sm:p-6 space-y-4 animate-[drop-in_320ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Export your analysis</h2>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Paste it into a chat you already pay for (ChatGPT Plus, Claude Plus, Gemini) and get a top model&apos;s answer on your real numbers, with no API cost.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-2 -m-2 rounded-full hover:bg-ink/[0.08]" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="What do you want from the AI?">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={goal === g.id}
                  onClick={() => choose(g.id)}
                  className={cn('text-left p-3 rounded-2xl border transition-colors', goal === g.id ? 'bg-ink text-background border-ink' : 'bg-ink/[0.04] border-ink/[0.08] hover:bg-ink/[0.08]')}
                >
                  <p className="text-sm font-bold">{g.title}</p>
                  <p className={cn('text-[12px] leading-snug mt-0.5', goal === g.id ? 'text-background/70' : 'text-muted-foreground')}>{g.blurb}</p>
                </button>
              ))}
            </div>

            {error ? (
              <p className="text-sm text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5">{error}</p>
            ) : (
              <>
                <textarea
                  id="export-preview"
                  readOnly
                  value={loading ? 'Building your export...' : text}
                  rows={9}
                  className="w-full rounded-2xl border border-border bg-background/60 p-3 text-[11px] leading-relaxed font-mono resize-y focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-muted-foreground">
                  {loading ? '' : `About ${tokens.toLocaleString()} tokens, well inside any chat app's limit. `}
                  It contains your numbers, short caption snippets, bio and competitors. No keys or tokens. Only paste it where you are happy to share that.
                </p>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} disabled={loading || !!error} className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-ink text-background text-sm font-bold hover:scale-[1.03] active:scale-[0.97] transition-transform disabled:opacity-50">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy text'}
              </button>
              <button type="button" onClick={download} disabled={loading || !!error} className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-sm font-bold hover:bg-ink/[0.12] disabled:opacity-50">
                <Download className="w-4 h-4" /> Download .md
              </button>
              {CHATS.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-[13px] font-bold text-muted-foreground hover:text-foreground hover:bg-ink/[0.06]">
                  {l.label} <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Tip: use a fresh chat, paste, and send. If a long paste is refused, attach the downloaded file instead.</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
