'use client';

import { useState } from 'react';
import { Copy, Sparkles, Trash2 } from 'lucide-react';
import { BRIEF_KINDS, briefToText, type BriefKind } from '@/lib/brandKit';
import { cn } from '@/lib/utils';
import { Field, Panel, area, btn, copyText, input, when, type Draft, type Kit, type PostRow } from './ui';

// A production brief for a designer or editor: format spec, slides or shots, creative direction, product accuracy
export function BriefBuilder({ account, kit, drafts, posts, reload }: { account: string; kit: Kit; drafts: Draft[]; posts: PostRow[]; reload: () => void }) {
  const [kind, setKind] = useState<BriefKind>('carousel');
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState(kit.products[0]?.id ?? '');
  const [lines, setLines] = useState(kit.briefs.templates.carousel);
  const [direction, setDirection] = useState(kit.briefs.direction);
  const [accuracy, setAccuracy] = useState(kit.briefs.accuracy);
  const [topic, setTopic] = useState('');
  const [sourcePost, setSourcePost] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'save' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const pick = (k: BriefKind) => {
    setKind(k);
    if (!loadedId) setLines(kit.briefs.templates[k]);
  };
  const data = { kind, productId, lines, direction, accuracy };
  const label = kind === 'feed' ? 'Shots or layout notes' : kind === 'reel' ? 'Shots, one per line' : 'Slides, one per line';
  const briefs = drafts.filter((d) => d.kind !== 'caption');

  const draft = async () => {
    setBusy('draft');
    setNote(null);
    try {
      const res = await fetch('/api/ai/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, kind: 'brief', briefKind: kind, productId, topic, fromPostId: sourcePost || undefined }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) setNote(out.error || 'Sage could not write that. Try again.');
      else {
        if (out.title) setTitle(out.title);
        if (Array.isArray(out.lines) && out.lines.length) setLines(out.lines.join('\n'));
        setLoadedId(null);
        setNote('Drafted. Edit anything, then save it.');
      }
    } catch {
      setNote('Could not reach the server. Try again.');
    }
    setBusy(null);
  };

  const save = async () => {
    setBusy('save');
    const res = loadedId
      ? await fetch(`/api/creative/${loadedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, data }) })
      : await fetch('/api/creative', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, kind, title: title || 'Untitled brief', data }) });
    const out = await res.json().catch(() => ({}));
    if (res.ok) {
      if (!loadedId && out.id) setLoadedId(out.id);
      setNote('Brief saved.');
      reload();
    } else setNote(out.error || 'Could not save.');
    setBusy(null);
  };

  const load = (d: Draft) => {
    const x = d.data as Partial<typeof data>;
    setKind((x.kind as BriefKind) ?? (d.kind as BriefKind));
    setTitle(d.title);
    setProductId(x.productId ?? '');
    setLines(x.lines ?? '');
    setDirection(x.direction ?? '');
    setAccuracy(x.accuracy ?? '');
    setLoadedId(d.id);
    setNote(null);
  };
  const reset = () => {
    setTitle('');
    setLines(kit.briefs.templates[kind]);
    setDirection(kit.briefs.direction);
    setAccuracy(kit.briefs.accuracy);
    setLoadedId(null);
    setNote(null);
  };
  const copy = async (t: string, b: typeof data) => setNote((await copyText(briefToText(kit, t || 'Untitled brief', b))) ? 'Brief copied as text.' : 'Could not copy.');
  const remove = async (id: string) => {
    await fetch(`/api/creative/${id}`, { method: 'DELETE' });
    if (loadedId === id) setLoadedId(null);
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={loadedId ? 'Edit brief' : 'New brief'} sub="What a designer needs: format, content, direction and what must be accurate.">
        <div className="flex flex-wrap items-center gap-2">
          {BRIEF_KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => pick(k.id)} aria-pressed={kind === k.id} className={cn('h-11 px-4 rounded-full text-[13px] font-bold transition-colors', kind === k.id ? 'bg-foreground text-background' : 'glass-field hover:bg-ink/[0.12]')}>{k.label}</button>
          ))}
          <span className="px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-400/25 text-violet-200 text-[12px] font-bold">{kit.briefs.specs[kind]}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 rounded-2xl bg-violet-500/[0.08] border border-violet-400/20 p-3">
          <Field label="Topic, for Sage" hint="Optional. What is this piece about?">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Why night routines matter" className={input} />
          </Field>
          <Field label="Build on a post that worked" hint="Optional.">
            <select value={sourcePost} onChange={(e) => setSourcePost(e.target.value)} className={input}>
              <option value="">Sage chooses</option>
              {posts.slice(0, 20).map((p) => <option key={p.id} value={p.id}>{p.caption.replace(/\s+/g, ' ').slice(0, 50) || p.type}</option>)}
            </select>
          </Field>
          <button type="button" onClick={draft} disabled={busy !== null} className={`${btn.primary} sm:col-span-2`}>
            <Sparkles className="w-4 h-4" /> {busy === 'draft' ? 'Sage is writing…' : 'Draft the brief with Sage'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Brief title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={input} /></Field>
          <Field label="Product">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={input}>
              <option value="">None</option>
              {kit.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label={label}><textarea value={lines} onChange={(e) => setLines(e.target.value)} className={`${area} min-h-[150px]`} /></Field>
        <Field label="Creative direction"><textarea value={direction} onChange={(e) => setDirection(e.target.value)} className={`${area} min-h-[130px]`} /></Field>
        <Field label="Product photo accuracy and reference"><textarea value={accuracy} onChange={(e) => setAccuracy(e.target.value)} className={area} /></Field>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={busy !== null} className={btn.primary}>{loadedId ? 'Update brief' : 'Save brief'}</button>
          <button type="button" onClick={() => copy(title, data)} className={btn.ghost}><Copy className="w-4 h-4" /> Copy as text</button>
          <button type="button" onClick={reset} className={btn.ghost}>New brief</button>
        </div>
        {note && <p role="status" className="text-[13px] font-semibold text-violet-300">{note}</p>}
      </Panel>

      <Panel title="Saved briefs">
        {briefs.length === 0 ? (
          <p className="text-[14px] text-muted-foreground rounded-2xl border border-dashed border-ink/20 p-5">No briefs yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {briefs.map((d) => {
              const x = d.data as Partial<typeof data>;
              return (
                <li key={d.id} className="rounded-2xl glass-field p-4 flex flex-col gap-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-200 text-[11px] font-bold mb-1.5">{BRIEF_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind}</span>
                      <p className="text-[14px] font-semibold leading-snug break-words">{d.title}</p>
                    </div>
                    <span className="text-[11.5px] text-muted-foreground shrink-0">{when(d.updatedAt)}</span>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button type="button" onClick={() => load(d)} className={btn.small}>Open</button>
                    <button type="button" onClick={() => copy(d.title, { kind: (x.kind as BriefKind) ?? (d.kind as BriefKind), productId: x.productId ?? '', lines: x.lines ?? '', direction: x.direction ?? '', accuracy: x.accuracy ?? '' })} className={btn.small}>Copy</button>
                    <button type="button" onClick={() => remove(d.id)} aria-label="Delete this brief" className={`${btn.small} ml-auto`}><Trash2 className="w-3.5 h-3.5" /></button>
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
