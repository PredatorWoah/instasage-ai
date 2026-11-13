'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, CircleAlert, Circle, Copy, Lightbulb, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { checkCaption, composeCaption, failing, feedPreview, parseHashtags, type Check as CheckRow, type WordRules } from '@/lib/brandKit';
import type { MakeFormat, ScriptBeat, Slide } from '@/services/ai';
import type { Vocab } from '@/services/vocab';
import { useCachedJson } from '@/lib/useCachedJson';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Field, Panel, area, btn, copyText, input, when, type Draft, type Kit, type PostRow } from './ui';

const TONE: Record<CheckRow['status'], string> = {
  ok: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25',
  warn: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  fail: 'bg-rose-500/12 text-rose-400 border-rose-500/30',
};
const ICON = { ok: Check, warn: Circle, fail: CircleAlert };

const FORMATS: { id: MakeFormat; label: string; blurb: string }[] = [
  { id: 'caption', label: 'Caption', blurb: 'A caption with 3 hook options' },
  { id: 'reel', label: 'Reel script', blurb: 'Shot by shot script, on-screen text, voiceover and caption' },
  { id: 'carousel', label: 'Carousel', blurb: 'Slide by slide text and the caption' },
];

const REWRITES = ['Shorter', 'Punchier hook', 'Use more proven words', 'Fix the checks', 'More casual', 'More expert'];

type Idea = { id: string; title: string; status: string; format?: string | null };
type Made = { format: MakeFormat; body: string; hashtags: string[]; hooks: string[]; script: ScriptBeat[]; slides: Slide[]; checks: CheckRow[] };

const scriptText = (s: ScriptBeat[]) => s.map((b) => `${b.time}  ${b.shot}${b.onScreen ? `\n  On screen: ${b.onScreen}` : ''}${b.voiceover ? `\n  Voiceover: ${b.voiceover}` : ''}`).join('\n\n');
const slidesText = (s: Slide[]) => s.map((x, i) => `Slide ${i + 1}: ${x.title}${x.text ? `\n${x.text}` : ''}`).join('\n\n');

// Make a caption, reel script or carousel with Sage, steered by the words that work for this account
export function Studio({ account, kit, drafts, posts, reload, initialTopic = '', initialPost = '' }: { account: string; kit: Kit; drafts: Draft[]; posts: PostRow[]; reload: () => void; initialTopic?: string; initialPost?: string }) {
  const { data: vocab } = useCachedJson<Vocab | null>(`/api/creative/words?account=${encodeURIComponent(account)}`);
  const { data: ideas } = useCachedJson<Idea[] | null>('/api/ideas/saved');
  const [format, setFormat] = useState<MakeFormat>('caption');
  const [productId, setProductId] = useState(kit.products[0]?.id ?? '');
  const [cta, setCta] = useState(kit.ctas[0] ?? '');
  const [topic, setTopic] = useState(initialTopic);
  const [sourcePost, setSourcePost] = useState(initialPost);
  const [strict, setStrict] = useState(true);
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [hooks, setHooks] = useState<string[]>([]);
  const [script, setScript] = useState<ScriptBeat[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const rules = useMemo<WordRules | undefined>(() => (vocab?.enough
    ? { good: vocab.words.good.map((t) => t.term), bad: vocab.words.bad.map((t) => t.term), tags: [...vocab.hashtags.good.map((t) => t.term), ...(vocab.hashtags.used ?? [])], badTags: vocab.hashtags.bad.map((t) => t.term), strict }
    : undefined), [vocab, strict]);
  const checks = useMemo(() => checkCaption(kit, { body, cta, hashtags }, rules), [kit, body, cta, hashtags, rules]);
  const bad = failing(checks);
  const full = composeCaption({ body, cta, hashtags });
  const preview = feedPreview(full);
  const captions = drafts.filter((d) => d.kind === 'caption');
  const openIdeas = (ideas ?? []).filter((i) => i.status !== 'posted').slice(0, 6);
  const winners = [...posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 15);

  const call = async (payload: Record<string, unknown>, label: string) => {
    setBusy(label);
    setNote(null);
    try {
      const res = await fetch('/api/ai/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, productId, cta, strict, ...payload }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Made> & { error?: string };
      if (!res.ok) {
        setNote(data.error || 'Sage could not write that. Try again.');
      } else {
        setBody(data.body ?? '');
        setHashtags((data.hashtags ?? []).join(' '));
        if (data.hooks?.length) setHooks(data.hooks);
        if (payload.kind === 'make') {
          setScript(data.script ?? []);
          setSlides(data.slides ?? []);
          setLoadedId(null);
        }
        const left = failing(data.checks ?? []);
        setNote(left.length ? `Still failing: ${left.map((c) => c.label).join(', ')}. Try a rewrite below.` : payload.kind === 'make' ? 'Done. Pick a hook, tweak anything, then save or copy.' : 'Rewritten.');
      }
    } catch {
      setNote('Could not reach the server. Try again.');
    }
    setBusy(null);
  };

  const make = () => call({ kind: 'make', format, topic, fromPostId: sourcePost || undefined }, 'make');
  const rewrite = (instruction: string) => body.trim() && call({ kind: 'rewrite', format, topic, instruction, currentBody: body, currentHashtags: hashtags }, instruction);

  // Swap the first line of the caption for another hook
  const pickHook = (h: string) => {
    const lines = body.split('\n');
    setBody(lines.length && body.trim() ? [h, ...lines.slice(1)].join('\n') : h);
  };
  const insertWord = (w: string) => {
    const el = bodyRef.current;
    const at = el ? el.selectionStart : body.length;
    const before = body.slice(0, at);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    setBody(`${before}${pad}${w}${body.slice(at)}`);
  };
  const addTags = (tags: string) => setHashtags((h) => [...new Set([...parseHashtags(h), ...parseHashtags(tags)])].join(' '));

  const save = async () => {
    if (!body.trim()) return;
    setBusy('save');
    const data = { format, body, cta, hashtags, productId, hooks, script, slides, topic };
    const title = body.replace(/\s+/g, ' ').trim().slice(0, 60);
    const res = loadedId
      ? await fetch(`/api/creative/${loadedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, data }) })
      : await fetch('/api/creative', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, kind: 'caption', title, data }) });
    const out = await res.json().catch(() => ({}));
    if (res.ok) {
      if (!loadedId && out.id) setLoadedId(out.id);
      setNote('Saved. Link it to the post it becomes, and Sage learns from how it did.');
      reload();
    } else setNote(out.error || 'Could not save.');
    setBusy(null);
  };

  const load = (d: Draft) => {
    const x = d.data as Partial<{ format: MakeFormat; body: string; cta: string; hashtags: string; productId: string; hooks: string[]; script: ScriptBeat[]; slides: Slide[]; topic: string }>;
    setFormat(x.format ?? 'caption');
    setBody(x.body ?? '');
    setCta(x.cta ?? '');
    setHashtags(x.hashtags ?? '');
    setProductId(x.productId ?? '');
    setHooks(x.hooks ?? []);
    setScript(x.script ?? []);
    setSlides(x.slides ?? []);
    setTopic(x.topic ?? '');
    setLoadedId(d.id);
    setNote(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const clear = () => {
    setBody(''); setHashtags(''); setHooks([]); setScript([]); setSlides([]); setLoadedId(null); setNote(null);
  };
  const copy = async (text: string, what: string) => setNote((await copyText(text)) ? `${what} copied.` : 'Could not copy. Select the text instead.');
  const link = async (id: string, postId: string) => {
    await fetch(`/api/creative/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: postId || null }) });
    reload();
  };
  const remove = async (id: string) => {
    await fetch(`/api/creative/${id}`, { method: 'DELETE' });
    if (loadedId === id) setLoadedId(null);
    reload();
  };

  const made = body.trim() || script.length || slides.length;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. What to make */}
      <Panel title="What are we making?">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Format">
          {FORMATS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={format === f.id} onClick={() => setFormat(f.id)} title={f.blurb} className={cn('h-11 px-5 rounded-full text-[13px] font-bold transition-colors', format === f.id ? 'bg-foreground text-background' : 'glass-field hover:bg-ink/[0.12]')}>{f.label}</button>
          ))}
        </div>
        <Field label="What is it about?" hint="A sentence is enough. Or tap one of your saved ideas.">
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder="Why the dark mark stays after a pimple, and how the serum helps it fade" className={`${area} min-h-[76px]`} />
        </Field>
        {openIdeas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground"><Lightbulb className="w-3.5 h-3.5" /> Your ideas:</span>
            {openIdeas.map((i) => (
              <button key={i.id} type="button" onClick={() => setTopic(i.title)} className={`${btn.small} max-w-[260px]`}><span className="truncate">{i.title}</span></button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <Field label="Build on a post that worked">
            <select value={sourcePost} onChange={(e) => setSourcePost(e.target.value)} className={input}>
              <option value="">Sage chooses</option>
              {winners.map((p) => <option key={p.id} value={p.id}>{p.views != null ? `${formatNumber(p.views)} views · ` : ''}{p.caption.replace(/\s+/g, ' ').trim().slice(0, 44) || p.type}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="inline-flex items-center gap-2.5 text-[14px] font-semibold min-h-11 cursor-pointer">
            <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="w-5 h-5 accent-violet-500" />
            Stick to words that work for this account
          </label>
          {vocab && !vocab.enough && <span className="text-[12.5px] text-muted-foreground">Only {vocab.posts} posts so far: word data gets useful from about 8.</span>}
        </div>
        <button type="button" onClick={make} disabled={busy !== null} className={`${btn.primary} w-full sm:w-auto sm:self-start sm:px-8`}>
          <Sparkles className="w-4 h-4" /> {busy === 'make' ? 'Sage is writing…' : made ? 'Make a new one' : 'Make it with Sage'}
        </button>
        {note && <p role="status" className="text-[13px] font-semibold text-indigo-400 break-words">{note}</p>}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 items-start">
        {/* 2. Shape it */}
        <Panel title="Shape it" sub={kit.voice ? `Voice: ${kit.voice}` : undefined}>
          {hooks.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold">Pick a hook</span>
              {hooks.map((h) => {
                const chosen = body.split('\n')[0].trim() === h.trim();
                return (
                  <button key={h} type="button" onClick={() => pickHook(h)} aria-pressed={chosen} className={cn('text-left rounded-2xl px-4 py-3 text-[14px] leading-snug border transition-colors break-words', chosen ? 'bg-violet-500/15 border-violet-400/50 font-semibold' : 'glass-field hover:bg-ink/[0.1]')}>
                    {chosen && <Check className="inline w-4 h-4 mr-1.5 -mt-0.5 text-indigo-400" />}{h}
                  </button>
                );
              })}
            </div>
          )}

          <Field label="Caption">
            <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Press Make it, or write here yourself. The CTA and hashtags are added below it." className={`${area} min-h-[170px]`} />
          </Field>
          <Field label="Hashtags">
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#yourtag #anothertag" className={input} />
          </Field>
          {kit.hashtagSets.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[12px] text-muted-foreground font-semibold">Add a set:</span>
              {kit.hashtagSets.map((s) => <button key={s.name} type="button" onClick={() => addTags(s.tags)} className={btn.small}>{s.name}</button>)}
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-2xl bg-violet-500/[0.08] border border-violet-400/20 p-3">
            <span className="text-[13px] font-bold inline-flex items-center gap-1.5"><Wand2 className="w-4 h-4 text-indigo-400" /> Rewrite with Sage</span>
            <div className="flex flex-wrap gap-2">
              {REWRITES.map((r) => (
                <button key={r} type="button" onClick={() => rewrite(r === 'Fix the checks' ? `Fix these: ${checks.filter((c) => c.status !== 'ok').map((c) => `${c.label} (${c.detail})`).join('; ') || 'tighten it'}` : r)} disabled={!body.trim() || busy !== null} className={btn.small}>
                  {busy === r ? 'Working…' : r}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (custom.trim()) rewrite(custom.trim()); }} className="flex gap-2">
              <label htmlFor="rewrite-custom" className="sr-only">Your own rewrite instruction</label>
              <input id="rewrite-custom" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Or say it: add the 10% offer, mix in Hinglish…" className={`${input} h-11`} />
              <button type="submit" disabled={!body.trim() || !custom.trim() || busy !== null} className={`${btn.small} h-11 shrink-0`}>Go</button>
            </form>
          </div>

          {script.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">Reel script</span>
                <button type="button" onClick={() => copy(scriptText(script), 'Script')} className={btn.small}><Copy className="w-3.5 h-3.5 mr-1" /> Copy script</button>
              </div>
              <ol className="flex flex-col gap-2">
                {script.map((b, i) => (
                  <li key={i} className="rounded-2xl glass-field p-3 flex flex-col gap-1 min-w-0">
                    <span className="text-[11.5px] font-extrabold text-indigo-400">{b.time || `Beat ${i + 1}`}</span>
                    <p className="text-[13.5px] font-semibold leading-snug break-words">{b.shot}</p>
                    {b.onScreen && <p className="text-[13px] leading-snug break-words"><span className="text-muted-foreground">On screen:</span> {b.onScreen}</p>}
                    {b.voiceover && <p className="text-[13px] leading-snug break-words"><span className="text-muted-foreground">Voiceover:</span> {b.voiceover}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {slides.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">Carousel slides</span>
                <button type="button" onClick={() => copy(slidesText(slides), 'Slides')} className={btn.small}><Copy className="w-3.5 h-3.5 mr-1" /> Copy slides</button>
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {slides.map((x, i) => (
                  <li key={i} className="rounded-2xl glass-field p-3 flex flex-col gap-1 min-w-0">
                    <span className="text-[11.5px] font-extrabold text-indigo-400">Slide {i + 1}</span>
                    <p className="text-[14px] font-bold leading-snug break-words">{x.title}</p>
                    {x.text && <p className="text-[13px] leading-snug text-foreground/80 break-words">{x.text}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={!body.trim() || busy !== null} className={btn.primary}>{loadedId ? 'Update draft' : 'Save draft'}</button>
            <button type="button" onClick={clear} className={btn.ghost}>Start over</button>
          </div>
          {kit.claimNote && <p className="text-[13px] text-muted-foreground leading-relaxed">{kit.claimNote}</p>}
        </Panel>

        <div className="flex flex-col gap-4 min-w-0">
          {/* 3. Check it */}
          <Panel title="Preview and checks">
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
              <button type="button" onClick={() => copy(full, 'Caption')} disabled={!full} className={btn.primary}><Copy className="w-4 h-4" /> {bad.length ? 'Copy anyway' : 'Copy caption'}</button>
              {bad.length > 0 && <span className="text-[12.5px] text-rose-400 font-semibold">{bad.length} check{bad.length > 1 ? 's' : ''} failing</span>}
            </div>
          </Panel>

          {/* What works */}
          <Panel title="What works for you" sub={vocab ? (vocab.enough ? `From your last ${vocab.posts} posts. Tap a word to add it where your cursor is.` : `Only ${vocab.posts} posts so far. This fills in as you post more.`) : 'Reading your posts…'}>
            {vocab?.enough ? (
              <>
                <TermList title="Proven words" tone="good" terms={vocab.words.good} onPick={insertWord} />
                <TermList title="Words that went with weaker posts" tone="bad" terms={vocab.words.bad} />
                <TermList title="Proven hashtags" tone="good" terms={vocab.hashtags.good} onPick={(t) => addTags(t)} />
                <TermList title="Weaker hashtags" tone="bad" terms={vocab.hashtags.bad} />
                {(vocab.style.length || vocab.style.hook) && (
                  <p className="text-[13px] leading-snug"><b>Your best captions:</b> {[vocab.style.length, vocab.style.hook, vocab.style.emojiFirstLine].filter(Boolean).join(', ')}.</p>
                )}
              </>
            ) : vocab === undefined ? (
              <div className="h-24 rounded-2xl glass-field animate-pulse" />
            ) : null}
          </Panel>
        </div>
      </div>

      <Panel title="Saved" sub="Link each one to the post it became. Sage reads how those posts did before writing the next one.">
        {captions.length === 0 ? (
          <p className="text-[14px] text-muted-foreground rounded-2xl border border-dashed border-ink/20 p-5">Nothing saved yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {captions.map((d) => {
              const x = d.data as { body?: string; cta?: string; hashtags?: string; format?: MakeFormat };
              return (
                <li key={d.id} className="rounded-2xl glass-field p-4 flex flex-col gap-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-violet-500/15 text-indigo-400 text-[11px] font-bold mb-1.5">{FORMATS.find((f) => f.id === (x.format ?? 'caption'))?.label}</span>
                      <p className="text-[14px] font-semibold leading-snug line-clamp-2 break-words">{x.body || d.title}</p>
                    </div>
                    <span className="text-[11.5px] text-muted-foreground shrink-0">{when(d.updatedAt)}</span>
                  </div>
                  {d.result && (
                    <p className="text-[12.5px] font-semibold text-emerald-400 break-words">Posted: {formatNumber(d.result.views)} views · {d.result.saves} saves · {d.result.shares} shares · {d.result.performanceScore.toFixed(1)}% eng</p>
                  )}
                  <select aria-label="Which post did this become?" value={d.postId ?? ''} onChange={(e) => link(d.id, e.target.value)} className={`${input} h-10 text-[12.5px]`}>
                    <option value="">Not posted yet</option>
                    {posts.slice(0, 40).map((p) => <option key={p.id} value={p.id}>{when(p.publishedAt)} · {p.caption.replace(/\s+/g, ' ').trim().slice(0, 40) || p.type}</option>)}
                  </select>
                  <div className="flex gap-2 mt-auto">
                    <button type="button" onClick={() => load(d)} className={btn.small}>Open</button>
                    <button type="button" onClick={() => copy(composeCaption({ body: x.body ?? '', cta: x.cta ?? '', hashtags: x.hashtags ?? '' }), 'Caption')} className={btn.small}>Copy</button>
                    <button type="button" onClick={() => remove(d.id)} aria-label="Delete this draft" className={`${btn.small} ml-auto`}><Trash2 className="w-3.5 h-3.5" /></button>
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

function TermList({ title, tone, terms, onPick }: { title: string; tone: 'good' | 'bad'; terms: { term: string; posts: number; lift: number }[]; onPick?: (t: string) => void }) {
  if (!terms.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-bold text-muted-foreground">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {terms.map((t) => {
          const label = (
            <>
              <span className="truncate">{t.term}</span>
              <span className="opacity-75 tabular-nums">{t.lift >= 0 ? '+' : ''}{t.lift}%</span>
            </>
          );
          const cls = cn('inline-flex items-center gap-1.5 max-w-full min-h-9 px-3 rounded-full text-[12.5px] font-semibold border', tone === 'good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border-rose-500/25 line-through decoration-1');
          return onPick ? (
            <button key={t.term} type="button" onClick={() => onPick(t.term)} title={`${t.posts} posts. Tap to add.`} className={cn(cls, 'hover:bg-emerald-500/20')}><Plus className="w-3 h-3 shrink-0" />{label}</button>
          ) : (
            <span key={t.term} title={`${t.posts} posts`} className={cls}>{label}</span>
          );
        })}
      </div>
    </div>
  );
}
