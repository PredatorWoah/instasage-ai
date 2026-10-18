'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, KeyRound, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clearJsonCache } from '@/lib/useCachedJson';
import { cn } from '@/lib/utils';

type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter';
type Provider = {
  id: ProviderId;
  label: string;
  company: string;
  keyPrefix: string;
  keyUrl: string;
  connected: boolean;
  source: 'saved' | 'env' | null;
  last4: string | null;
  model: string | null;
  models: string[];
};
type Route = { provider: ProviderId; model?: string };
type Status = { active: ProviderId | null; providers: Provider[]; routing: Record<string, Route>; groups: { id: string; label: string }[] };

const LOOK: Record<ProviderId, { mark: string; tile: string }> = {
  gemini: { mark: 'G', tile: 'bg-[linear-gradient(135deg,#4F8BFF,#9B72FF)]' },
  anthropic: { mark: 'C', tile: 'bg-[linear-gradient(135deg,#E38B5C,#C2603B)]' },
  openai: { mark: 'AI', tile: 'bg-[linear-gradient(135deg,#1FB58F,#0E7C63)]' },
  openrouter: { mark: 'OR', tile: 'bg-[linear-gradient(135deg,#8C7BFF,#FF6F91)]' },
};

const link = (href: string, text: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{text}</a>
);

const STEPS: Record<ProviderId, { title: string; steps: React.ReactNode[]; note: React.ReactNode }> = {
  gemini: {
    title: 'How to get a free key from Google AI Studio',
    steps: [
      <>Open {link('https://aistudio.google.com/apikey', 'aistudio.google.com/apikey')} and sign in with any Google account.</>,
      <>First time only: accept the Gemini API terms.</>,
      <>Click <b>Create API key</b>. If it asks for a project, pick the suggested one or click <b>Create project</b>.</>,
      <>Copy the key (it starts with <code>AIza</code>) and paste it below.</>,
    ],
    note: <>Free tier is enough for personal use. &quot;Quota reached&quot; means wait a minute, or until tomorrow.</>,
  },
  anthropic: {
    title: 'How to get a Claude API key',
    steps: [
      <>Open {link('https://platform.claude.com/settings/keys', 'the Claude Console')} and sign in. It is separate from a Claude.ai Pro subscription, which does not include API use.</>,
      <>Add a few dollars of credit under <b>Billing</b>. The API is pay as you go.</>,
      <>Under <b>API keys</b>, click <b>Create key</b>, name it &quot;InstaSage&quot;.</>,
      <>Copy the key (it starts with <code>sk-ant-</code>) and paste it below.</>,
    ],
    note: <>Default model is Claude Opus 5, with Anthropic&apos;s server side fallback switched on: if a safety check declines a request, Anthropic reruns it on a fallback model inside the same call. Sonnet 5 is faster and cheaper; Haiku 4.5 is the budget pick.</>,
  },
  openai: {
    title: 'How to get an OpenAI (ChatGPT) API key',
    steps: [
      <>Open {link('https://platform.openai.com/api-keys', 'platform.openai.com/api-keys')} and sign in. ChatGPT Plus does not cover API use.</>,
      <>Add credit under <b>Settings → Billing</b>.</>,
      <>Click <b>Create new secret key</b>, copy it (starts with <code>sk-</code>).</>,
      <>Paste it below. InstaSage reads which GPT models your key can use and picks the newest.</>,
    ],
    note: <>Pay as you go. A month of normal InstaSage use usually costs cents, not dollars.</>,
  },
  openrouter: {
    title: 'How to use Llama, DeepSeek, Mistral, Grok and friends',
    steps: [
      <>Open {link('https://openrouter.ai/settings/keys', 'openrouter.ai')} and sign in. One key reaches hundreds of models.</>,
      <>Click <b>Create key</b> and copy it (starts with <code>sk-or-</code>).</>,
      <>Add credit, or pick a model ending in <code>:free</code> below to pay nothing.</>,
      <>Paste the key below, optionally with the model you want.</>,
    ],
    note: <>Model ids look like <code>deepseek/deepseek-chat</code> or <code>meta-llama/llama-3.3-70b-instruct</code>. Browse them at {link('https://openrouter.ai/models', 'openrouter.ai/models')}.</>,
  },
};

export function AiSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<ProviderId>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    fetch('/api/settings/ai')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Status | null) => {
        if (!data) return;
        setStatus(data);
        if (data.active) setSelected(data.active);
        else setShowSteps(true);
      })
      .catch(() => {});
  }, []);

  const current = status?.providers.find((p) => p.id === selected);
  const pick = (id: ProviderId) => {
    setSelected(id);
    setApiKey('');
    setModel('');
    setShowSteps(!status?.providers.find((p) => p.id === id)?.connected);
  };

  // Every AI answer came from the old provider; let pages fetch fresh ones
  const updated = (data: Status) => {
    setStatus(data);
    clearJsonCache();
  };

  const call = async (label: string, method: string, body?: object, query = '') => {
    setBusy(label);
    const res = await fetch(`/api/settings/ai${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error('That did not work', { description: data.error });
      return null;
    }
    updated(data);
    return data;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call('save', 'PUT', { provider: selected, apiKey, model: model || undefined });
    if (data) {
      setApiKey('');
      setModel('');
      setShowSteps(false);
      toast.success(`${current?.label} key works`, { description: `Now answering with ${data.saved.model}.` });
    }
  };

  const changeModel = async (next: string) => {
    if (!next || next === current?.model) return;
    const data = await call('model', 'PATCH', { provider: selected, model: next });
    if (data) toast.success('Model switched', { description: `${current?.label} now uses ${next}.` });
  };

  const activate = async () => {
    const data = await call('activate', 'PATCH', { provider: selected, activate: true });
    if (data) toast.success(`${current?.label} is now your AI`);
  };

  const refreshList = async () => {
    const data = await call('refresh', 'PATCH', { provider: selected, refreshModels: true });
    if (!data) return;
    toast.success('Model list updated', {
      description: data.refreshed.changed ? `Your old model is gone, so ${current?.label} now uses ${data.refreshed.model}.` : `Still using ${data.refreshed.model}.`,
    });
  };

  const remove = async () => {
    if (!confirm(`Remove your ${current?.label} key?`)) return;
    const data = await call('remove', 'DELETE', undefined, `?provider=${selected}`);
    if (data) toast.success(`${current?.label} key removed`);
  };

  if (!status) return <div className="h-40 rounded-xl bg-secondary/10 animate-pulse" />;
  const steps = STEPS[selected];

  return (
    <div className="space-y-4">
      {/* Provider picker */}
      <div className="grid grid-cols-2 gap-2">
        {status.providers.map((p) => {
          const active = status.active === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              aria-pressed={selected === p.id}
              className={cn(
                'relative flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-[0.98]',
                selected === p.id ? 'border-ink/40 bg-ink/[0.07]' : 'border-ink/[0.07] bg-ink/[0.02] hover:bg-ink/[0.05]'
              )}
            >
              <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-extrabold text-white shrink-0', LOOK[p.id].tile)}>
                {LOOK[p.id].mark}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold truncate">{p.label}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
                  {active && <span className="inline-flex items-center gap-0.5 text-emerald-400 font-bold shrink-0"><Zap className="w-2.5 h-2.5" />Active ·</span>}
                  <span className="truncate">{p.connected ? (p.last4 ? `••••${p.last4}` : 'From hosting env') : p.company}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {current && (
        <div className="space-y-4 rounded-2xl border border-ink/[0.07] bg-ink/[0.02] p-4">
          {current.connected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs font-medium truncate">
                    {current.last4 ? `Key ending in ••••${current.last4}` : 'Using GEMINI_API_KEY from your hosting settings'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {status.active !== current.id && (
                    <Button size="sm" onClick={activate} disabled={!!busy} className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700">
                      {busy === 'activate' ? 'Switching...' : `Use ${current.label}`}
                    </Button>
                  )}
                  {current.last4 && (
                    <Button variant="outline" size="sm" onClick={remove} disabled={!!busy} className="text-xs h-7">Remove</Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-model" className="text-xs">Model</Label>
                  {selected !== 'anthropic' && (
                    <button type="button" onClick={refreshList} disabled={!!busy} className="text-[11px] text-indigo-400 hover:underline disabled:opacity-50">
                      {busy === 'refresh' ? 'Checking...' : 'Refresh models'}
                    </button>
                  )}
                </div>
                <ModelPicker
                  key={`${current.id}:${current.model}`}
                  id="ai-model"
                  models={current.models}
                  value={current.model ?? ''}
                  disabled={!!busy}
                  onPick={changeModel}
                />
                {busy === 'model' && <p className="text-[11px] text-muted-foreground">Testing the new model...</p>}
                {selected === 'gemini' && /argon/.test(current.model ?? '') && (
                  <p className="text-[11px] text-muted-foreground">Gemini 4 Argon is Google&apos;s newest flagship and, going by its launch coverage, needs a paid Gemini API plan. If it errors, pick a Flash model.</p>
                )}
                {selected === 'gemini' && (
                  <p className="text-[11px] text-muted-foreground">Google retires old models. If one disappears, InstaSage switches to a current one by itself. <b>Refresh models</b> does it on demand and shows what your key can use now (look for <code>gemini-4-argon</code>).</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={save} className="space-y-2">
            <Label htmlFor="ai-key" className="text-xs">{current.connected ? 'Replace key' : `${current.label} API key`}</Label>
            <div className="relative">
              <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`${current.keyPrefix}...`}
                className="pl-8 h-9 text-xs bg-secondary/50 border-border"
                required
              />
            </div>
            {!current.connected && (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                list="ai-model-suggestions"
                placeholder={`Model (optional, default ${current.models[0] ?? 'auto'})`}
                className="h-9 text-xs bg-secondary/50 border-border"
              />
            )}
            <datalist id="ai-model-suggestions">
              {current.models.map((m) => <option key={m} value={m} />)}
            </datalist>
            <Button type="submit" size="sm" disabled={!!busy} className="w-full text-xs h-9 bg-indigo-600 hover:bg-indigo-700">
              {busy === 'save' ? 'Testing key...' : current.connected ? 'Replace key' : `Save and use ${current.label}`}
            </Button>
            <p className="text-[11px] text-muted-foreground">InstaSage sends a tiny test message first and only saves keys that work. Keys stay on the server; only the last 4 characters are ever shown.</p>
          </form>

          <div className="rounded-xl border border-border bg-secondary/10">
            <button
              type="button"
              onClick={() => setShowSteps((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left gap-3"
              aria-expanded={showSteps}
            >
              {steps.title}
              <span className="text-muted-foreground shrink-0">{showSteps ? 'Hide' : 'Show'}</span>
            </button>
            {showSteps && (
              <div className="px-3 pb-3 space-y-3">
                <ol className="list-decimal pl-4 space-y-1.5 text-xs text-muted-foreground leading-relaxed [&_code]:text-[10px] [&_code]:px-1 [&_code]:rounded [&_code]:bg-secondary">
                  {steps.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
                <p className="text-[11px] text-muted-foreground border-t border-border pt-2 [&_code]:text-[10px] [&_code]:px-1 [&_code]:rounded [&_code]:bg-secondary">{steps.note}</p>
                <a href={current.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline">
                  Get a {current.label} key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {status.providers.filter((p) => p.connected).length > 0 && (
        <RoutingPanel status={status} disabled={!!busy} onSave={(routing) => call('routing', 'PATCH', { routing })} />
      )}

      {status.providers.filter((p) => p.connected).length > 1 && (
        <p className="text-[11px] text-muted-foreground">
          Backup is on: if {status.providers.find((p) => p.id === status.active)?.label ?? 'your AI'} is overloaded or out of quota, InstaSage quietly asks your other saved AI instead.
        </p>
      )}
    </div>
  );
}

// Which AI answers which feature, e.g. a strong model for the Game plan and a free one for chat
function RoutingPanel({ status, disabled, onSave }: { status: Status; disabled: boolean; onSave: (routing: Record<string, Route | null>) => Promise<unknown> }) {
  const [open, setOpen] = useState(Object.keys(status.routing).length > 0);
  const connected = status.providers.filter((p) => p.connected);
  const activeLabel = status.providers.find((p) => p.id === status.active)?.label ?? 'your active AI';
  const field = 'h-8 rounded-md border border-border bg-secondary/50 px-2 text-xs min-w-0';

  const change = async (group: string, provider: string, model?: string) => {
    const data = await onSave({ [group]: provider ? { provider: provider as ProviderId, ...(model ? { model } : {}) } : null });
    if (data) toast.success('Saved', { description: provider ? `${status.groups.find((g) => g.id === group)?.label} now uses ${status.providers.find((p) => p.id === provider)?.label}${model ? ` (${model})` : ''}.` : 'Back to your active AI.' });
  };

  return (
    <div className="rounded-2xl border border-ink/[0.07] bg-ink/[0.02]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3 text-left gap-3">
        <span>
          <span className="block text-sm font-bold">Different AI per feature</span>
          <span className="block text-[11px] text-muted-foreground">For example a strong model for the Game plan and a free one for Sage chat. Anything left on default uses {activeLabel}.</span>
        </span>
        <span className="text-xs text-indigo-400 shrink-0">{open ? 'Hide' : 'Set up'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {status.groups.map((g) => {
            const route = status.routing[g.id];
            const models = route ? status.providers.find((p) => p.id === route.provider)?.models ?? [] : [];
            return (
              <div key={g.id} className="grid sm:grid-cols-[1fr_140px_1fr] gap-2 items-center">
                <span className="text-xs font-medium">{g.label}</span>
                <select aria-label={`AI for ${g.label}`} value={route?.provider ?? ''} disabled={disabled} onChange={(e) => change(g.id, e.target.value)} className={field}>
                  <option value="">Default ({activeLabel})</option>
                  {connected.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                {route ? (
                  <select aria-label={`Model for ${g.label}`} value={route.model ?? ''} disabled={disabled} onChange={(e) => change(g.id, route.provider, e.target.value)} className={field}>
                    <option value="">Its saved model</option>
                    {models.slice(0, 300).map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : <span className="hidden sm:block" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// A plain select for short lists; a searchable browser for OpenRouter's hundreds of models
function ModelPicker({ id, models, value, disabled, onPick }: {
  id: string;
  models: string[];
  value: string;
  disabled: boolean;
  onPick: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [vendor, setVendor] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const options = models.includes(value) || !value ? models : [value, ...models];
  const field = 'w-full h-9 rounded-md border border-border bg-secondary/50 px-2.5 text-xs';

  if (options.length <= 50) {
    return (
      <select id={id} value={value} disabled={disabled} onChange={(e) => onPick(e.target.value)} className={field}>
        {options.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    );
  }

  const vendors = VENDORS.filter((v) => options.some((m) => m.startsWith(`${v.id}/`)));
  const q = query.trim().toLowerCase();
  const matches = options.filter((m) => (!vendor || m.startsWith(`${vendor}/`)) && (!freeOnly || m.endsWith(':free')) && (!q || m.toLowerCase().includes(q)));
  const choose = (model: string) => {
    setOpen(false);
    setQuery('');
    onPick(model);
  };

  return (
    <div className="space-y-2">
      <button type="button" id={id} disabled={disabled} onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`${field} flex items-center justify-between text-left`}>
        <span className="truncate">{value || 'Pick a model'}</span>
        <span className="text-indigo-400 shrink-0 ml-2">{open ? 'Close' : `Browse ${options.length} models`}</span>
      </button>

      {open && (
        <div className="rounded-xl border border-border bg-secondary/20 p-2 space-y-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: llama, claude, gpt, grok, mistral..." autoFocus className="h-8 text-xs bg-secondary/50 border-border" />
          <div className="flex flex-wrap gap-1.5">
            <Chip active={freeOnly} onClick={() => setFreeOnly((v) => !v)}>Free only</Chip>
            {vendors.map((v) => (
              <Chip key={v.id} active={vendor === v.id} onClick={() => setVendor(vendor === v.id ? null : v.id)}>{v.label}</Chip>
            ))}
          </div>
          <ul className="max-h-64 overflow-y-auto divide-y divide-border/50 rounded-lg border border-border/60 bg-background/40">
            {matches.slice(0, 150).map((m) => (
              <li key={m}>
                <button type="button" onClick={() => choose(m)} className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left text-xs hover:bg-ink/[0.06] ${m === value ? 'bg-ink/[0.08] font-bold' : ''}`}>
                  <span className="truncate">{m.replace(/:free$/, '')}</span>
                  {m.endsWith(':free') && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">free</span>}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-2.5 py-3 text-xs text-muted-foreground">No match. Type a full model id from openrouter.ai/models to use it anyway.</li>}
          </ul>
          {query.trim().includes('/') && !options.includes(query.trim()) && (
            <button type="button" onClick={() => choose(query.trim())} className="w-full text-left text-xs rounded-lg border border-dashed border-indigo-400/40 px-2.5 py-2 text-indigo-300 hover:bg-indigo-500/10">
              Use <b>{query.trim()}</b> as a custom model id
            </button>
          )}
          <p className="text-[11px] text-muted-foreground">
            {matches.length > 150 ? `Showing 150 of ${matches.length}, keep typing to narrow it. ` : `${matches.length} models. `}
            Not listed? Type its full id (like <code>vendor/model-name</code>) from <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">openrouter.ai/models</a>.
          </p>
        </div>
      )}
    </div>
  );
}

const VENDORS = [
  { id: 'anthropic', label: 'Claude' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'google', label: 'Google' },
  { id: 'meta-llama', label: 'Llama' },
  { id: 'mistralai', label: 'Mistral' },
  { id: 'x-ai', label: 'Grok' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'qwen', label: 'Qwen' },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${active ? 'bg-ink text-background' : 'bg-ink/[0.07] text-muted-foreground hover:text-foreground'}`}>
      {children}
    </button>
  );
}
