'use client';

import { useMemo, useState } from 'react';
import { Check, CircleAlert, Circle, Copy, Sparkles, Trash2 } from 'lucide-react';
import { checkCaption, composeCaption, failing, feedPreview, parseHashtags, type Check as CheckRow } from '@/lib/brandKit';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Field, Panel, area, btn, copyText, input, when, type Draft, type Kit, type PostRow } from './ui';

const TONE: Record<CheckRow['status'], string> = {
  ok: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25',
  warn: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  fail: 'bg-rose-500/12 text-rose-400 border-rose-500/30',
};
const ICON = { ok: Check, warn: Circle, fail: CircleAlert };

// Write a caption against the account's own rules, with live checks. Sage can draft it and fixes what fails.
export function CaptionLab({ account, kit, drafts, posts, reload, initialTopic = '', initialPost = '' }: { account: string; kit: Kit; drafts: Draft[]; posts: PostRow[]; reload: () => void; initialTopic?: string; initialPost?: string }) {
  const [productId, setProductId] = useState(kit.products[0]?.id ?? '');
  const [cta, setCta] = useState(kit.ctas[0] ?? '');
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [topic, setTopic] = useState(initialTopic);
  const [sourcePost, setSourcePost] = useState(initialPost);
  const [busy, setBusy] = useState<'draft' | 'fix' | 'save' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const checks = useMemo(() => checkCaption(kit, { body, cta, hashtags }), [kit, body, cta, hashtags]);
  const bad = failing(checks);
  const full = composeCaption({ body, cta, hashtags });
  const preview = feedPreview(full);
  const captions = drafts.filter((d) => d.kind === 'caption');

  const draft = async (fix = false) => {
    setBusy(fix ? 'fix' : 'draft');
    setNote(null);
    try {
      const res = await fetch('/api/ai/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, kind: 'caption', productId, cta, topic, fromPostId: sourcePost || undefined, ...(fix ? { fixBody: body, fixHashtags: hashtags } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNote(data.error || 'Sage could not write that. Try again.');
      else {
        setBody(data.body ?? '');
        setHashtags((data.hashtags ?? []).join(' '));
        if (!fix) setLoadedId(null);
        const left = failing(data.checks ?? []);
        setNote(left.length ? `Sage's draft still fails: ${left.map((c: CheckRow) => c.label).join(', ')}. Edit it or draft again.` : fix ? 'Fixed. It passes every check now.' : 'Drafted, and it passes every check.');
      }
    } catch {
      setNote('Could not reach the server. Try again.');
    }
    setBusy(null);
  };

  const save = async () => {
    if (!body.trim()) return;
    setBusy('save');
    const data = { body, cta, hashtags, productId };
    const title = body.replace(/\s+/g, ' ').trim().slice(0, 60);
    const res = loadedId
      ? await fetch(`/api/creative/${loadedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, data }) })
      : await fetch('/api/creative', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, kind: 'caption', title, data }) });
    const out = await res.json().catch(() => ({}));
    if (res.ok) {
      if (!loadedId && out.id) setLoadedId(out.id);
      setNote('Saved to your captions.');
      reload();
    } else setNote(out.error || 'Could not save.');
    setBusy(null);
  };

  const load = (d: Draft) => {
    const x = d.data as { body?: string; cta?: string; hashtags?: string; productId?: string };
    setBody(x.body ?? '');
    setCta(x.cta ?? '');
    setHashtags(x.hashtags ?? '');
    setProductId(x.productId ?? '');
    setLoadedId(d.id);
    setNote(null);
  };

  const copy = async () => setNote((await copyText(full)) ? 'Copied.' : 'Could not copy. Select the preview text instead.');
  const clear = () => { setBody(''); setHashtags(''); setLoadedId(null); setNote(null); };
  const addSet = (name: string) => {
    const set = kit.hashtagSets.find((s) => s.name === name);
    // Tags already in the caption are not added twice
    if (set) setHashtags((h) => [...new Set([...parseHashtags(h), ...parseHashtags(set.tags)])].join(' '));
  };
  const link = async (id: string, postId: string) => {
    await fetch(`/api/creative/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: postId || null }) });
    reload();
  };
  const remove = async (id: string) => {
    await fetch(`/api/creative/${id}`, { method: 'DELETE' });
    if (loadedId === id) setLoadedId(null);
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 items-start">
        <Panel title="Write it" sub={kit.voice ? `Voice: ${kit.voice}` : 'Set a voice and rules in your Brand kit.'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Product">
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={input}>
                <option value="">None</option>
                {kit.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="CTA">
              <select value={cta} onChange={(e) => setCta(e.target.value)} className={input}>
                <option value="">None</option>
                {kit.ctas.map((c) => <option key={c} value={c}>{c}</option>)}
                {cta && !kit.ctas.includes(cta) && <option value={cta}>{cta}</option>}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 rounded-2xl bg-violet-500/[0.08] border border-violet-400/20 p-3">
            <Field label="Topic, for Sage" hint="Optional. What should this caption be about?">
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Morning routine, 3 steps" className={input} />
            </Field>
            <Field label="Build on a post that worked" hint="Optional. Same angle, new words.">
              <select value={sourcePost} onChange={(e) => setSourcePost(e.target.value)} className={input}>
                <option value="">Sage chooses</option>
                {posts.slice(0, 20).map((p) => <option key={p.id} value={p.id}>{when(p.publishedAt)} · {p.caption.replace(/\s+/g, ' ').trim().slice(0, 48) || p.type}</option>)}
              </select>
            </Field>
            <button type="button" onClick={() => draft()} disabled={busy !== null} className={`${btn.primary} sm:col-span-2`}>
              <Sparkles className="w-4 h-4" /> {busy === 'draft' ? 'Sage is writing…' : body ? 'Draft again with Sage' : 'Draft with Sage'}
            </button>
          </div>

          <Field label="Caption body">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the body here. The CTA and hashtags are added below it." className={`${area} min-h-[150px]`} />
          </Field>
          <Field label="Hashtags">
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#yourtag #anothertag" className={input} />
          </Field>
          {kit.hashtagSets.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[12px] text-muted-foreground font-semibold">Add a set:</span>
              {kit.hashtagSets.map((s) => <button key={s.name} type="button" onClick={() => addSet(s.name)} className={btn.small}>{s.name}</button>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={!body.trim() || busy !== null} className={btn.primary}>{loadedId ? 'Update draft' : 'Save draft'}</button>
            <button type="button" onClick={clear} className={btn.ghost}>New draft</button>
          </div>
          {kit.claimNote && <p className="text-[13px] text-muted-foreground leading-relaxed">{kit.claimNote}</p>}
          {note && <p role="status" className="text-[13px] font-semibold text-indigo-400">{note}</p>}
        </Panel>

        <Panel title="Caption preview">
          <ul className="flex flex-col gap-2">
            {checks.map((c) => {
              const Icon = ICON[c.status];
              return (
                <li key={c.id} className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13.5px] leading-snug', TONE[c.status])}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words"><b className="font-semibold">{c.label}</b>{c.detail && <span className="opacity-80"> · {c.detail}</span>}</span>
                </li>
              );
            })}
          </ul>
          <div className="rounded-2xl glass-field p-4 min-h-[92px] text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">
            {full || <span className="text-muted-foreground">Your caption shows here exactly as it will be posted.</span>}
          </div>
          {full && (
            <p className="text-[12.5px] text-muted-foreground leading-snug break-words">
              <b className="text-foreground">In the feed, before &ldquo;more&rdquo;:</b> {preview.text}{preview.cut ? '…' : ''}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} disabled={!full} className={btn.primary}><Copy className="w-4 h-4" /> {bad.length ? 'Copy anyway' : 'Copy caption'}</button>
            {body.trim() && checks.some((c) => c.status !== 'ok') && (
              <button type="button" onClick={() => draft(true)} disabled={busy !== null} className={btn.ghost}><Sparkles className="w-4 h-4" /> {busy === 'fix' ? 'Fixing…' : 'Fix with Sage'}</button>
            )}
            {bad.length > 0 && <span className="text-[12.5px] text-rose-400 font-semibold">{bad.length} check{bad.length > 1 ? 's' : ''} failing</span>}
          </div>
        </Panel>
      </div>

      <Panel title="Saved captions" sub="Link one to the post it became and you can see how that wording did.">
        {captions.length === 0 ? (
          <p className="text-[14px] text-muted-foreground rounded-2xl border border-dashed border-ink/20 p-5">Nothing saved yet. Write one above and press Save draft.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {captions.map((d) => {
              const x = d.data as { body?: string };
              return (
                <li key={d.id} className="rounded-2xl glass-field p-4 flex flex-col gap-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold leading-snug line-clamp-2 break-words">{x.body || d.title}</p>
                    <span className="text-[11.5px] text-muted-foreground shrink-0">{when(d.updatedAt)}</span>
                  </div>
                  {d.result && (
                    <p className="text-[12.5px] font-semibold text-emerald-400 break-words">Posted: {formatNumber(d.result.views)} views · {d.result.saves} saves · {d.result.shares} shares · {d.result.performanceScore.toFixed(1)}% eng</p>
                  )}
                  <select aria-label="Which post did this become?" value={d.postId ?? ''} onChange={(e) => link(d.id, e.target.value)} className={`${input} h-10 text-[12.5px]`}>
                    <option value="">Not posted yet</option>
                    {posts.slice(0, 40).map((p) => <option key={p.id} value={p.id}>Posted as: {p.caption.replace(/\s+/g, ' ').slice(0, 40) || p.type} · {when(p.publishedAt)}</option>)}
                  </select>
                  <div className="flex gap-2 mt-auto">
                    <button type="button" onClick={() => load(d)} className={btn.small}>Open</button>
                    <button type="button" onClick={async () => copyText(composeCaption({ body: x.body ?? '', cta: String((d.data as { cta?: string }).cta ?? ''), hashtags: String((d.data as { hashtags?: string }).hashtags ?? '') }))} className={btn.small}>Copy</button>
                    <button type="button" onClick={() => remove(d.id)} aria-label="Delete this caption" className={`${btn.small} ml-auto`}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
