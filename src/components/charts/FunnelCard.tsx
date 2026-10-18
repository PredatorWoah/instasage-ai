import { formatNumber } from '@/utils/formatters';

export type FunnelData = { reach: number | null; accountsEngaged: number | null; profileViews: number | null; linkTaps: number | null; follows: number | null; unfollows: number | null };

// Where people drop off on the way from seeing a post to following: last 30 days
export function FunnelCard({ funnel }: { funnel: FunnelData }) {
  const steps = [
    { label: 'Accounts reached', value: funnel.reach, color: 'bg-[#4CC9F0]' },
    { label: 'Engaged (liked, commented, saved, shared)', value: funnel.accountsEngaged, color: 'bg-[#7B61FF]' },
    { label: 'Visited your profile', value: funnel.profileViews, color: 'bg-[#FF6B9A]' },
    { label: 'Tapped your link', value: funnel.linkTaps, color: 'bg-[#FFE066]' },
  ].filter((s) => s.value != null) as { label: string; value: number; color: string }[];
  const top = Math.max(1, ...steps.map((s) => s.value));
  const net = funnel.follows != null && funnel.unfollows != null ? funnel.follows - funnel.unfollows : null;

  if (!steps.length && funnel.follows == null) {
    return <p className="text-sm text-muted-foreground">Instagram hasn&apos;t returned profile visits or follows yet. They arrive with the next sync (Instagram only shares them for professional accounts).</p>;
  }

  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-5">
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          // Profile visits can outnumber engaged accounts (people visit without liking), so compare
          // with the nearest earlier step that is at least as big, so the rate never reads over 100%
          const prev = steps.slice(0, i).reverse().find((x) => x.value >= s.value && x.value > 0);
          const rate = prev ? (s.value / prev.value) * 100 : null;
          return (
            <div key={s.label}>
              <div className="flex items-baseline justify-between gap-3 text-[13px] mb-1">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="tabular-nums"><b className="text-foreground">{formatNumber(s.value)}</b>{rate != null && <span className="text-muted-foreground"> · {rate < 1 ? rate.toFixed(2) : rate.toFixed(1)}% of {prev!.label.split(' (')[0].toLowerCase()}</span>}</span>
              </div>
              <div className="h-3 rounded-full bg-ink/[0.05] overflow-hidden">
                <div className={`h-full rounded-full ${s.color}`} style={{ width: `${Math.max(1.5, (s.value / top) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 lg:grid-cols-1 gap-2">
        {[
          { label: 'New follows', value: funnel.follows, tone: 'text-emerald-400' },
          { label: 'Unfollows', value: funnel.unfollows, tone: 'text-rose-400' },
          { label: 'Net', value: net, tone: net != null && net < 0 ? 'text-rose-400' : 'text-foreground' },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl bg-ink/[0.03] border border-ink/[0.05] px-3 py-2.5">
            <p className={`font-display font-extrabold text-[22px] leading-none ${x.tone}`}>{x.value == null ? '—' : `${x.label === 'Net' && x.value > 0 ? '+' : ''}${formatNumber(x.value)}`}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{x.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
