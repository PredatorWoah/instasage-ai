'use client';

import { useCachedJson } from '@/lib/useCachedJson';

type Total = { key: string; requests: number; input: number; output: number; cost: number; unpriced: number };
type KeyUsage = { total: number | null; daily: number | null; weekly: number | null; monthly: number | null; limit: number | null; remaining: number | null };
type Usage = { total: Total; byFeature: Total[]; byModel: Total[]; openrouter: KeyUsage | null };

const FEATURE_LABELS: Record<string, string> = {
  insights: 'AI Insights', recommendations: 'Quick wins', plan: 'Game plan', brainstorm: 'Brainstorm', chat: 'Sage chat',
  post: 'Post analysis', report: 'Report reviews', competitors: 'Competitor takeaways', writer: 'Scripts and captions', replies: 'Comment replies',
};

const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const usd = (n: number) => `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;

// What OpenRouter itself says the key has spent: exact, and includes anything InstaSage didn't log
function OpenRouterBilling({ u }: { u: KeyUsage }) {
  const cells = [
    { label: 'Today', value: u.daily },
    { label: 'This week', value: u.weekly },
    { label: 'This month', value: u.monthly },
    { label: 'All time', value: u.total },
  ].filter((c) => c.value != null) as { label: string; value: number }[];
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">OpenRouter billing (from OpenRouter)</p>
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {cells.map((c) => (
            <div key={c.label}>
              <p className="font-bold tabular-nums">{usd(c.value)}</p>
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
        {u.limit != null && (
          <p className="text-[11px] text-muted-foreground">Key limit {usd(u.limit)}{u.remaining != null ? `, ${usd(u.remaining)} left` : ''}.</p>
        )}
      </div>
    </div>
  );
}

const money = (t: Total) => (t.requests === t.unpriced ? 'not priced' : `$${t.cost < 0.01 ? t.cost.toFixed(4) : t.cost.toFixed(2)}${t.unpriced ? '+' : ''}`);

function Table({ title, rows, label }: { title: string; rows: Total[]; label: (k: string) => string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{title}</p>
      <div className="rounded-xl border border-border divide-y divide-border/60">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="truncate">{label(r.key)}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{r.requests} · {tokens(r.input + r.output)} tokens · <b className="text-foreground">{money(r)}</b></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// What the AI did over the last 30 days, and roughly what it cost
export function AiUsageCard() {
  const { data } = useCachedJson<Usage>('/api/settings/usage');
  if (data === undefined) return <div className="h-28 rounded-xl bg-secondary/10 animate-pulse" />;
  if (!data || (data.total.requests === 0 && !data.openrouter)) return <p className="text-xs text-muted-foreground">No AI answers recorded yet. Usage shows up here as you use Insights, the Ideas Studio and Sage.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'AI answers', value: String(data.total.requests) },
          { label: 'Tokens', value: tokens(data.total.input + data.total.output) },
          { label: 'Logged cost, 30 days', value: money(data.total) },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl bg-ink/[0.03] border border-ink/[0.05] p-3">
            <p className="font-display font-extrabold text-[20px] leading-none">{x.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{x.label}</p>
          </div>
        ))}
      </div>
      {data.openrouter && <OpenRouterBilling u={data.openrouter} />}
      <Table title="By feature" rows={data.byFeature} label={(k) => FEATURE_LABELS[k] ?? k} />
      <Table title="By model" rows={data.byModel} label={(k) => k} />
      <p className="text-[11px] text-muted-foreground">Per-answer costs are exact for OpenRouter and estimated from list prices for Claude. OpenRouter&apos;s own totals above can be a little higher: they also count key checks and anything used before InstaSage started logging. Gemini and ChatGPT show tokens only, since their prices vary by model and plan; &quot;+&quot; means some answers had no price. Free tiers cost nothing whatever this says.</p>
    </div>
  );
}
