'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = { source: 'saved' | 'env' | null; last4: string | null; model: string | null };

const STEPS = [
  <>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">aistudio.google.com/apikey</a> and sign in with any Google account.</>,
  <>First time only: accept the Gemini API terms when AI Studio asks.</>,
  <>Click <b>Create API key</b>. If it asks for a project, pick the suggested one (for example &quot;Default Gemini Project&quot;) or click <b>Create project</b>.</>,
  <>Copy the key. It is a long string that usually starts with <code className="text-[10px] px-1 rounded bg-secondary">AIza</code>.</>,
  <>Paste it below and press <b>Save key</b>. InstaSage sends Gemini a tiny test message and only saves the key if it works.</>,
];

export function AiSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    fetch('/api/settings/ai')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setStatus(data);
        if (data && !data.source) setShowSteps(true);
      })
      .catch(() => setStatus(null));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setStatus(data);
      setApiKey('');
      setShowSteps(false);
      toast.success('Gemini key works', { description: `AI features are on, using ${data.model}.` });
    } else {
      toast.error('Key not saved', { description: data.error });
    }
  };

  const remove = async () => {
    if (!confirm('Remove your Gemini key? AI features stop working until you add one again.')) return;
    const res = await fetch('/api/settings/ai', { method: 'DELETE' });
    if (res.ok) {
      setStatus(await res.json());
      toast.success('Gemini key removed');
    }
  };

  return (
    <div className="space-y-4">
      {status?.source === 'saved' && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Key ending in ••••{status.last4} is active</p>
              {status.model && <p className="text-[10px] text-muted-foreground truncate">Model: {status.model}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={remove} className="text-xs h-7 shrink-0">Remove</Button>
        </div>
      )}
      {status?.source === 'env' && (
        <p className="text-xs text-muted-foreground">Using the GEMINI_API_KEY from your hosting settings. Saving a key here overrides it.</p>
      )}

      <form onSubmit={save} className="space-y-1.5">
        <Label htmlFor="gemini-key" className="text-xs">{status?.source === 'saved' ? 'Replace key' : 'Gemini API key'}</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              id="gemini-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="pl-8 h-8 text-xs bg-secondary/50 border-border"
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={saving} className="text-xs h-8 shrink-0 bg-indigo-600 hover:bg-indigo-700">
            {saving ? 'Testing...' : 'Save key'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-secondary/10">
        <button
          type="button"
          onClick={() => setShowSteps((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium"
          aria-expanded={showSteps}
        >
          How to get a free key from Google AI Studio
          <span className="text-muted-foreground">{showSteps ? 'Hide' : 'Show'}</span>
        </button>
        {showSteps && (
          <div className="px-3 pb-3 space-y-3">
            <ol className="list-decimal pl-4 space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {STEPS.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
            <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border pt-2">
              <p><b className="text-foreground">Free tier:</b> enough for personal use. If you see &quot;quota reached&quot;, wait a minute or try again tomorrow.</p>
              <p><b className="text-foreground">&quot;Not valid&quot; error:</b> copy the key again with no spaces, or create a new one.</p>
              <p><b className="text-foreground">Keep it private:</b> anyone with the key can use your quota. Delete it in AI Studio if it leaks.</p>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"
            >
              Open Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
