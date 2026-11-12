'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BRIEF_KINDS, PRESETS, normalizeKit, presetKit, type BrandKit } from '@/lib/brandKit';
import { primeJson } from '@/lib/useCachedJson';
import { Field, Panel, area, btn, input, type Kit } from './ui';

const lines = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

// Everything that differs between accounts. Each account keeps its own; presets are only a starting point.
export function BrandKitEditor({ account, accountName, kit, reload, others = [] }: { account: string; accountName: string; kit: Kit; reload: () => void; others?: { id: string; username: string }[] }) {
  const [k, setK] = useState<BrandKit>(kit);
  const [flaggedText, setFlaggedText] = useState(kit.flagged.join('\n'));
  const [ctaText, setCtaText] = useState(kit.ctas.join('\n'));
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const set = (patch: Partial<BrandKit>) => setK((cur) => ({ ...cur, ...patch }));

  const applyPreset = (id: string) => {
    const p = presetKit(id);
    // Keeps what is specific to this account: its name, products and hashtag sets
    const next = { ...p, brandName: k.brandName, products: k.products, hashtagSets: k.hashtagSets };
    setK(next);
    setFlaggedText(next.flagged.join('\n'));
    setCtaText(next.ctas.join('\n'));
    setNote(`${PRESETS.find((x) => x.id === id)?.label} rules applied. Save to keep them.`);
  };

  // Start from another account's kit: fills the form, nothing is saved until you press Save
  const copyFrom = async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/brand-kit?account=${id}`);
    if (!res.ok) return setNote('Could not load that kit.');
    const next = normalizeKit(await res.json());
    setK(next);
    setFlaggedText(next.flagged.join('\n'));
    setCtaText(next.ctas.join('\n'));
    setNote(`Copied from @${others.find((o) => o.id === id)?.username}. Check it over, then save.`);
  };

  const save = async () => {
    setSaving(true);
    setNote(null);
    const kitToSave = { ...k, ctas: lines(ctaText), flagged: lines(flaggedText) };
    const res = await fetch('/api/brand-kit', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, kit: kitToSave }) });
    const out = await res.json().catch(() => ({}));
    if (res.ok) {
      primeJson(`/api/brand-kit?account=${account}`, out);
      setNote('Saved. The Caption lab and Sage now use this kit for this account.');
      reload();
    } else setNote(out.error || 'Could not save.');
    setSaving(false);
  };

  const num = (key: keyof BrandKit['rules'], label: string) => (
    <Field label={label} key={key}>
      <input type="number" min={0} inputMode="numeric" value={Number(k.rules[key])} onChange={(e) => set({ rules: { ...k.rules, [key]: Math.max(0, Number(e.target.value) || 0) } })} className={input} />
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel title={`Brand kit for @${accountName}`} sub="Switch accounts at the top and each one keeps its own kit. Pick a preset to start, then change anything.">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => applyPreset(p.id)} title={p.blurb} aria-pressed={k.preset === p.id} className={`${btn.small} ${k.preset === p.id ? '!bg-foreground !text-background' : ''}`}>{p.label}</button>
          ))}
        </div>
        {others.length > 0 && (
          <select aria-label="Copy the kit from another account" value="" onChange={(e) => copyFrom(e.target.value)} className={`${input} sm:max-w-[320px]`}>
            <option value="">Copy from another account…</option>
            {others.map((o) => <option key={o.id} value={o.id}>@{o.username}</option>)}
          </select>
        )}
        <p className="text-[12.5px] text-muted-foreground">{PRESETS.find((p) => p.id === k.preset)?.blurb} A preset changes the rules, voice and brief templates. Your name, products and hashtag sets stay.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Brand or account name"><input value={k.brandName} onChange={(e) => set({ brandName: e.target.value })} className={input} /></Field>
          <Field label="Voice" hint="How should captions sound?"><input value={k.voice} onChange={(e) => set({ voice: e.target.value })} className={input} /></Field>
        </div>
      </Panel>

      <Panel title="Products" sub="What you sell or talk about. The Caption lab and briefs let you pick one.">
        <div className="flex flex-col gap-3">
          {k.products.map((p, i) => (
            <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 items-start">
              <input aria-label="Product name" value={p.name} onChange={(e) => set({ products: k.products.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Product name" className={input} />
              <input aria-label="Product notes" value={p.notes} onChange={(e) => set({ products: k.products.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)) })} placeholder="Facts Sage may use: size, key ingredient, price" className={input} />
              <button type="button" aria-label={`Remove ${p.name || 'product'}`} onClick={() => set({ products: k.products.filter((_, j) => j !== i) })} className={`${btn.small} h-12 w-12 px-0`}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => set({ products: [...k.products, { id: crypto.randomUUID(), name: '', notes: '' }] })} className={`${btn.ghost} self-start`}><Plus className="w-4 h-4" /> Add a product</button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Calls to action" sub="One per line. Captions get exactly one.">
          <textarea aria-label="Calls to action" value={ctaText} onChange={(e) => setCtaText(e.target.value)} className={`${area} min-h-[140px]`} />
        </Panel>
        <Panel title="Flagged claims and words" sub="One per line. A caption that contains one fails its check.">
          <textarea aria-label="Flagged claims and words" value={flaggedText} onChange={(e) => setFlaggedText(e.target.value)} className={`${area} min-h-[140px]`} />
          <Field label="Note shown under the caption box"><input value={k.claimNote} onChange={(e) => set({ claimNote: e.target.value })} className={input} /></Field>
          <p className="text-[12.5px] text-muted-foreground leading-snug">This is a word filter, not legal or regulatory advice. Confirm claims and substantiation separately.</p>
        </Panel>
      </div>

      <Panel title="Caption rules">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {num('minChars', 'Min characters')}
          {num('maxChars', 'Max characters')}
          {num('minTags', 'Min hashtags')}
          {num('maxTags', 'Max hashtags')}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="inline-flex items-center gap-2.5 text-[14px] font-semibold min-h-11"><input type="checkbox" checked={k.rules.oneCta} onChange={(e) => set({ rules: { ...k.rules, oneCta: e.target.checked } })} className="w-5 h-5 accent-violet-500" /> Exactly one CTA, outside the body</label>
          <label className="inline-flex items-center gap-2.5 text-[14px] font-semibold min-h-11"><input type="checkbox" checked={k.rules.noEmDashes} onChange={(e) => set({ rules: { ...k.rules, noEmDashes: e.target.checked } })} className="w-5 h-5 accent-violet-500" /> No em dashes</label>
        </div>
      </Panel>

      <Panel title="Hashtag sets" sub="Named groups you can add to a caption in one tap.">
        <div className="flex flex-col gap-3">
          {k.hashtagSets.map((s, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)_auto] gap-2">
              <input aria-label="Set name" value={s.name} onChange={(e) => set({ hashtagSets: k.hashtagSets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Set name" className={input} />
              <input aria-label="Hashtags" value={s.tags} onChange={(e) => set({ hashtagSets: k.hashtagSets.map((x, j) => (j === i ? { ...x, tags: e.target.value } : x)) })} placeholder="#tag #tag #tag" className={input} />
              <button type="button" aria-label={`Remove ${s.name || 'set'}`} onClick={() => set({ hashtagSets: k.hashtagSets.filter((_, j) => j !== i) })} className={`${btn.small} h-12 w-12 px-0`}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => set({ hashtagSets: [...k.hashtagSets, { name: '', tags: '' }] })} className={`${btn.ghost} self-start`}><Plus className="w-4 h-4" /> Add a set</button>
        </div>
      </Panel>

      <Panel title="Brief defaults" sub="What every new brief starts with.">
        <Field label="Creative direction"><textarea value={k.briefs.direction} onChange={(e) => set({ briefs: { ...k.briefs, direction: e.target.value } })} className={`${area} min-h-[130px]`} /></Field>
        <Field label="Accuracy and reference note"><textarea value={k.briefs.accuracy} onChange={(e) => set({ briefs: { ...k.briefs, accuracy: e.target.value } })} className={area} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {BRIEF_KINDS.map((b) => (
            <div key={b.id} className="flex flex-col gap-2">
              <Field label={`${b.label} format`}><input value={k.briefs.specs[b.id]} onChange={(e) => set({ briefs: { ...k.briefs, specs: { ...k.briefs.specs, [b.id]: e.target.value } } })} className={input} /></Field>
              <Field label={`${b.label} starting lines`}><textarea value={k.briefs.templates[b.id]} onChange={(e) => set({ briefs: { ...k.briefs, templates: { ...k.briefs.templates, [b.id]: e.target.value } } })} className={`${area} min-h-[130px]`} /></Field>
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3 sticky bottom-20 sm:bottom-4 z-10">
        <button type="button" onClick={save} disabled={saving} className={`${btn.primary} shadow-lg`}>{saving ? 'Saving…' : 'Save brand kit'}</button>
        {note && <p role="status" className="text-[13px] font-semibold text-indigo-400 glass-panel rounded-full px-4 py-2">{note}</p>}
      </div>
    </div>
  );
}
