// A brand kit is everything that is different between accounts: what you sell, how you sound, what you
// may not claim, and the rules a caption must pass. One kit per account; presets are only starting points.

export type BriefKind = 'carousel' | 'feed' | 'reel';
export const BRIEF_KINDS: { id: BriefKind; label: string }[] = [
  { id: 'carousel', label: 'Carousel' },
  { id: 'feed', label: 'Feed ad' },
  { id: 'reel', label: 'Reel' },
];

export type BrandKit = {
  preset: string;
  brandName: string;
  voice: string;
  products: { id: string; name: string; notes: string }[];
  ctas: string[];
  flagged: string[]; // claims and words a caption must not contain
  claimNote: string; // shown under the caption box
  hashtagSets: { name: string; tags: string }[];
  rules: { minChars: number; maxChars: number; minTags: number; maxTags: number; oneCta: boolean; noEmDashes: boolean };
  briefs: {
    direction: string;
    accuracy: string;
    specs: Record<BriefKind, string>;
    templates: Record<BriefKind, string>;
  };
};

const SPECS: Record<BriefKind, string> = { carousel: '1080 × 1350 · 4:5', feed: '1080 × 1350 · 4:5', reel: '1080 × 1920 · 9:16' };

const GENERIC: BrandKit = {
  preset: 'generic',
  brandName: '',
  voice: '',
  products: [],
  ctas: ['Save this for later.', 'Follow for more.', 'Send this to a friend.'],
  flagged: [],
  claimNote: '',
  hashtagSets: [],
  rules: { minChars: 40, maxChars: 2200, minTags: 0, maxTags: 8, oneCta: true, noEmDashes: false },
  briefs: {
    direction: '',
    accuracy: 'Use approved imagery. Record the reference file or link here.',
    specs: SPECS,
    templates: {
      carousel: 'Hook slide\nThe problem or question\nThe key point, one per slide\nThe takeaway\nOne call to action',
      feed: 'Single image: lead message, one proof point, one call to action',
      reel: 'Hook in the first 2 seconds\nShow the thing\nOne tip or step\nClose with one call to action',
    },
  },
};

export const PRESETS: { id: string; label: string; blurb: string; kit: BrandKit }[] = [
  { id: 'generic', label: 'Universal', blurb: 'Any account. No product rules, light checks.', kit: GENERIC },
  {
    id: 'skincare',
    label: 'Skincare and cosmetics',
    blurb: 'Qualified claim language, product accuracy, one clear action.',
    kit: {
      ...GENERIC,
      preset: 'skincare',
      voice: 'Calm, specific and honest. Qualified cosmetic language, no miracle promises.',
      ctas: ['Save this routine.', 'Shop the serum.', 'Tell us your skin concern in the comments.'],
      flagged: ['cure', 'cures', 'treat', 'treats', 'heal', 'heals', 'repair', 'repairs', 'clinically proven', 'guaranteed', 'permanent', 'permanently', 'removes wrinkles', 'eliminates', 'erases', 'detox', 'medical grade', 'prescription', 'anti-aging'],
      claimNote: 'Use "helps" or "appearance of" for supported benefits. Check product facts against your internal reports.',
      rules: { minChars: 60, maxChars: 250, minTags: 3, maxTags: 5, oneCta: true, noEmDashes: true },
      briefs: {
        ...GENERIC.briefs,
        direction: 'Premium editorial composition. Real skin texture, visible pores, natural tonal variation. Soft directional studio light. Left-aligned modern sans-serif. Use real pack photography whenever the product is shown. Avoid generic template layouts, fantasy CGI, bubbles, sparkles and plastic-looking skin.',
        accuracy: 'Use the approved product photograph when it is shown. Check the exact label, bottle, cap, colour and proportions. Record the reference filename or link here.',
        templates: {
          carousel: 'Statement hook and skin concern\nExplain the concern with a realistic macro detail\nShow one practical routine step\nConnect the step to the selected product if relevant\nClose with one save or shop CTA',
          feed: 'Single image: lead message, true-to-pack product photo, verified offer if relevant, one CTA',
          reel: 'Hook on the concern in the first 2 seconds\nApply the product on real skin\nOne routine tip\nClose with one CTA',
        },
      },
    },
  },
  {
    id: 'fitness',
    label: 'Fitness and wellness',
    blurb: 'No guaranteed results or medical claims.',
    kit: {
      ...GENERIC,
      preset: 'fitness',
      voice: 'Direct, encouraging, practical. Real effort, no shortcuts promised.',
      ctas: ['Save this workout.', 'Send this to your gym partner.', 'Comment "plan" and I will send it.'],
      flagged: ['guaranteed', 'cure', 'cures', 'lose weight fast', 'burn fat fast', 'detox', 'miracle', 'no effort', 'overnight results'],
      claimNote: 'Talk about effort and habits, not guaranteed results or medical outcomes.',
      rules: { minChars: 40, maxChars: 600, minTags: 3, maxTags: 8, oneCta: true, noEmDashes: false },
    },
  },
];

export const presetKit = (id: string): BrandKit => structuredClone((PRESETS.find((p) => p.id === id) ?? PRESETS[0]).kit);

const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback);
const list = (v: unknown, max = 40, each = 160) => (Array.isArray(v) ? v.map((x) => str(x, each).trim()).filter(Boolean).slice(0, max) : []);

// Whatever is stored (or sent) becomes a complete, safe kit: missing parts fall back to the Universal preset
export function normalizeKit(raw: unknown): BrandKit {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const base = GENERIC;
  const rules = (r.rules && typeof r.rules === 'object' ? r.rules : {}) as Record<string, unknown>;
  const briefs = (r.briefs && typeof r.briefs === 'object' ? r.briefs : {}) as Record<string, unknown>;
  const specs = (briefs.specs && typeof briefs.specs === 'object' ? briefs.specs : {}) as Record<string, unknown>;
  const templates = (briefs.templates && typeof briefs.templates === 'object' ? briefs.templates : {}) as Record<string, unknown>;
  const products = Array.isArray(r.products) ? r.products : [];
  const sets = Array.isArray(r.hashtagSets) ? r.hashtagSets : [];
  const kinds = BRIEF_KINDS.map((k) => k.id);
  return {
    preset: str(r.preset, 40) || base.preset,
    brandName: str(r.brandName, 80),
    voice: str(r.voice, 600),
    products: products.slice(0, 40).map((p, i) => {
      const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return { id: str(o.id, 40) || `p${i}-${Date.now().toString(36)}`, name: str(o.name, 120).trim(), notes: str(o.notes, 600) };
    }).filter((p) => p.name),
    ctas: list(r.ctas),
    flagged: list(r.flagged, 100, 60),
    claimNote: str(r.claimNote, 400),
    hashtagSets: sets.slice(0, 20).map((s) => {
      const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      return { name: str(o.name, 60).trim(), tags: str(o.tags, 400) };
    }).filter((s) => s.name),
    rules: {
      minChars: num(rules.minChars, base.rules.minChars),
      maxChars: Math.max(1, num(rules.maxChars, base.rules.maxChars)),
      minTags: num(rules.minTags, base.rules.minTags),
      maxTags: num(rules.maxTags, base.rules.maxTags),
      oneCta: rules.oneCta !== false,
      noEmDashes: rules.noEmDashes === true,
    },
    briefs: {
      direction: str(briefs.direction, 1500),
      accuracy: str(briefs.accuracy, 800) || base.briefs.accuracy,
      specs: Object.fromEntries(kinds.map((k) => [k, str(specs[k], 60) || SPECS[k]])) as Record<BriefKind, string>,
      templates: Object.fromEntries(kinds.map((k) => [k, str(templates[k], 1500) || base.briefs.templates[k]])) as Record<BriefKind, string>,
    },
  };
}

// ---------- Caption checks: plain code, instant, no AI ----------

export type Check = { id: string; status: 'ok' | 'warn' | 'fail'; label: string; detail: string };
export type CaptionInput = { body: string; cta: string; hashtags: string };

export const parseHashtags = (text: string) => [...new Set((text.match(/#[^\s#]+/g) ?? []).map((t) => t.toLowerCase()))];

// What the post will actually say: body, then the CTA, then the tags
export const composeCaption = (c: CaptionInput) => [c.body.trim(), c.cta.trim(), c.hashtags.trim()].filter(Boolean).join('\n\n');

const CTA_WORDS = /\b(shop now|shop the|link in bio|save this|save it|follow (?:us|me|for)|comment|dm (?:us|me)|tap|buy now|order now|swipe|share this|send this|tag a)\b/gi;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function flaggedHits(kit: BrandKit, text: string) {
  return kit.flagged.filter((term) => new RegExp(`(^|[^\\p{L}])${escape(term.trim())}($|[^\\p{L}])`, 'iu').test(text));
}

export function checkCaption(kit: BrandKit, input: CaptionInput): Check[] {
  const r = kit.rules;
  const full = composeCaption(input);
  const tags = parseHashtags(input.hashtags + ' ' + input.body);
  const bodyCtas = [...new Set((input.body.match(CTA_WORDS) ?? []).map((m) => m.toLowerCase()))];
  const checks: Check[] = [];

  const len = full.length;
  checks.push(
    len < r.minChars ? { id: 'length', status: 'warn', label: `${len} / ${r.maxChars} characters`, detail: `minimum ${r.minChars}` }
    : len > r.maxChars ? { id: 'length', status: 'fail', label: `${len} / ${r.maxChars} characters`, detail: `${len - r.maxChars} over the limit` }
    : { id: 'length', status: 'ok', label: `${len} / ${r.maxChars} characters`, detail: 'within the range' },
  );

  if (r.maxTags > 0) {
    checks.push(
      tags.length < r.minTags ? { id: 'tags', status: 'warn', label: `${tags.length} hashtags`, detail: `use ${r.minTags} to ${r.maxTags} unique tags` }
      : tags.length > r.maxTags ? { id: 'tags', status: 'fail', label: `${tags.length} hashtags`, detail: `no more than ${r.maxTags}` }
      : { id: 'tags', status: 'ok', label: `${tags.length} hashtags`, detail: 'a good number of unique tags' },
    );
  }

  if (r.oneCta) {
    const extra = input.cta.trim() ? bodyCtas.length : Math.max(0, bodyCtas.length - 1);
    checks.push(
      !input.cta.trim() && bodyCtas.length === 0 ? { id: 'cta', status: 'warn', label: 'No CTA yet', detail: 'pick one clear action' }
      : extra > 0 ? { id: 'cta', status: 'fail', label: 'More than one CTA', detail: `keep "${bodyCtas.join('", "')}" out of the body` }
      : { id: 'cta', status: 'ok', label: 'One CTA', detail: 'a single clear action' },
    );
  }

  if (r.noEmDashes) {
    checks.push(/[—–]/.test(full) ? { id: 'dashes', status: 'fail', label: 'Em dashes found', detail: 'use a full stop, comma or colon instead' } : { id: 'dashes', status: 'ok', label: 'No em dashes', detail: '' });
  }

  if (kit.flagged.length) {
    const hits = flaggedHits(kit, full);
    checks.push(hits.length ? { id: 'flagged', status: 'fail', label: `Flagged: ${hits.join(', ')}`, detail: 'soften or remove these claims' } : { id: 'flagged', status: 'ok', label: 'No flagged claims', detail: 'confirm substantiation separately' });
  }
  return checks;
}

// Instagram cuts a caption at about 125 characters in the feed: this is the part people see before "more"
export const FEED_CUT = 125;
export function feedPreview(full: string) {
  const first = full.split('\n')[0];
  return { text: first.slice(0, FEED_CUT), cut: first.length > FEED_CUT || full.includes('\n') };
}

export const failing = (checks: Check[]) => checks.filter((c) => c.status === 'fail');

// A saved brief as plain text, to paste into a design tool or send to a designer
export type BriefData = { kind: BriefKind; productId: string; lines: string; direction: string; accuracy: string };
export function briefToText(kit: BrandKit, title: string, b: BriefData) {
  const product = kit.products.find((p) => p.id === b.productId);
  return [
    `${BRIEF_KINDS.find((k) => k.id === b.kind)?.label ?? 'Brief'}: ${title}`,
    kit.briefs.specs[b.kind],
    product ? `Product: ${product.name}` : '',
    '',
    b.kind === 'feed' ? 'Shots or layout notes' : b.kind === 'reel' ? 'Shots' : 'Slides',
    b.lines.trim(),
    '',
    'Creative direction',
    b.direction.trim(),
    '',
    'Product photo accuracy and reference',
    b.accuracy.trim(),
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
