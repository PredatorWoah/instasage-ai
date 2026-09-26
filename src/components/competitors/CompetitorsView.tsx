'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Heart, MessageCircle, Plus, RefreshCw, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import type { CompetitorPost, CompetitorStats } from '@/services/competitors';
import type { CompetitorTakeaways } from '@/services/ai';
import { useCachedJson, primeJson } from '@/lib/useCachedJson';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { formatLabel } from '@/lib/platform';
import { formatNumber, formatRelativeTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';

type Row = {
  id?: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
  followers: number;
  mediaCount: number;
  stats: CompetitorStats | null;
  posts?: CompetitorPost[] | null;
  biography?: string | null;
  error?: string | null;
  lastSyncedAt?: string;
};
type Data = {
  configured: boolean;
  usesConfigId: boolean;
  redirectUri: string;
  link: { igUsername: string; pageName: string; expiresAt: string | null } | null;
  you: Row[];
  competitors: Row[];
};
type Takeaways = { takeaways: CompetitorTakeaways; model: string; createdAt: string } | null;

const URL_ = '/api/competitors';

export function CompetitorsView() {
  const { data, refresh } = useCachedJson<Data>(URL_);
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const error = params.get('error');
    const connected = params.get('connected');
    if (error) toast.error('Facebook connection failed', { description: error });
    if (connected) {
      toast.success(`Connected through @${connected}`, { description: 'Now add a competitor by username.' });
      refresh();
    }
    if (error || connected) router.replace('/competitors');
  }, [params, router, refresh]);

  if (data === undefined) return <div className="h-96 rounded-[30px] bg-card animate-pulse" />;
  if (!data) return <p className="text-sm text-muted-foreground">Could not load competitors.</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Competitors</h1>
        <p className="text-[15px] text-muted-foreground mt-3">Real public numbers from any Business or Creator account, side by side with yours</p>
      </div>
      {data.link ? <Tracker data={data} refresh={refresh} /> : <Setup data={data} />}
    </div>
  );
}

// ---------- Not connected yet ----------

function Setup({ data }: { data: Data }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(data.redirectUri).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: 'Link your Instagram to a Facebook Page',
      body: <>Your Instagram must be a Business or Creator account linked to a Facebook Page you manage. In the Instagram app: <b>Edit profile → Page → Connect</b> (or on Facebook: <b>Page settings → Linked accounts → Instagram</b>). Any Page works, even an empty one made for this.</>,
    },
    {
      title: 'Add Facebook Login to your Meta app',
      body: (
        <>
          At <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">developers.facebook.com/apps</a>, open the same app you made for Instagram → <b>Add product</b> → <b>Facebook Login for Business</b> (or <b>Facebook Login</b>) → <b>Settings</b>, and paste this under <b>Valid OAuth Redirect URIs</b>:
          <span className="mt-2 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-[11px] px-2 py-1.5 rounded-lg bg-secondary">{data.redirectUri}</code>
            <button type="button" onClick={copy} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14]">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </span>
        </>
      ),
    },
    {
      title: 'Business apps only: create a login configuration',
      body: <>If Meta shows <b>Configurations</b> under Facebook Login for Business, create one: token type <b>User access token</b>, permissions <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>business_management</code>. Copy its <b>Configuration ID</b> into Vercel as <code>FACEBOOK_LOGIN_CONFIG_ID</code>.</>,
    },
    {
      title: 'Give InstaSage the app keys',
      body: <>In the Meta app: <b>App settings → Basic</b>. Copy <b>App ID</b> and <b>App secret</b> (the main ones at the top, not the Instagram ones) into Vercel as <code>FACEBOOK_APP_ID</code> and <code>FACEBOOK_APP_SECRET</code>, then <b>Redeploy</b>.</>,
    },
    {
      title: 'Connect',
      body: <>Press <b>Connect with Facebook</b> below and tick the Page linked to your Instagram. While the app is in Development mode only you (the app admin) can log in, which is exactly who needs to.</>,
    },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4">
      <section className="relative overflow-hidden rounded-[34px] prism-hero p-7 sm:p-9 flex flex-col gap-5">
        <div aria-hidden className="absolute -right-24 -top-32 w-[380px] h-[380px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.5),transparent)]" />
        <span className="relative self-start px-3.5 py-1.5 rounded-full glass-chip text-[13px] font-bold">One time setup · about 10 minutes</span>
        <h2 className="relative text-[30px] sm:text-[42px] leading-[1] tracking-[-0.045em]">See what your rivals post, how often, and what lands.</h2>
        <p className="relative text-white/90 text-[15px] leading-relaxed">
          Followers, posting rhythm, format mix, likes and comments per post, their best posts and hashtags, plus an AI breakdown of what to borrow and what to skip.
          Meta only allows this through Facebook Login, so it is a second connection next to your Instagram one.
        </p>
        <div className="relative mt-auto flex flex-wrap items-center gap-3">
          {data.configured ? (
            <a href="/api/connect/facebook" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-white text-[#0A0A0F] font-bold text-sm hover:scale-[1.03] active:scale-[0.97] transition-transform">
              <span className="w-5 h-5 rounded-full bg-[#1877F2] text-white text-[13px] font-extrabold flex items-center justify-center">f</span>
              Connect with Facebook
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 h-12 px-5 rounded-full glass-chip text-sm font-bold">
              <TriangleAlert className="w-4 h-4" /> Waiting for FACEBOOK_APP_ID and FACEBOOK_APP_SECRET
            </span>
          )}
          {data.configured && <span className="text-[12px] text-white/80">{data.usesConfigId ? 'Using your login configuration' : 'Using standard permissions'}</span>}
        </div>
      </section>

      <section className="rounded-[34px] bg-card border border-white/[0.05] p-5 sm:p-6">
        <h3 className="text-lg font-bold mb-4">How to set it up</h3>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className={cn('w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-extrabold', i === 3 && data.configured ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.08]')}>
                {i === 3 && data.configured ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 text-[13px] text-muted-foreground leading-relaxed [&_code]:text-[11px] [&_code]:px-1 [&_code]:rounded [&_code]:bg-secondary [&_b]:text-foreground">
                <p className="text-sm font-bold text-foreground mb-0.5">{s.title}</p>
                {s.body}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

// ---------- Connected ----------

function Tracker({ data, refresh }: { data: Data; refresh: () => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const link = data.link!;
  const [now] = useState(() => Date.now());
  const daysLeft = link.expiresAt ? Math.round((new Date(link.expiresAt).getTime() - now) / 86400_000) : null;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('add');
    const res = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error('Could not add that account', { description: body.error });
    toast.success(`Tracking @${body.username}`);
    setUsername('');
    refresh();
  };

  const refreshAll = async () => {
    setBusy('refresh');
    const res = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: true }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (body.failed?.length) toast.error(`${body.failed.length} could not refresh`, { description: body.failed.join('\n') });
    else toast.success('All competitors refreshed');
    refresh();
  };

  const remove = async (row: Row) => {
    if (!confirm(`Stop tracking @${row.username}?`)) return;
    await fetch(`${URL_}?id=${row.id}`, { method: 'DELETE' });
    refresh();
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Facebook? Tracked competitors stay, but stop refreshing.')) return;
    await fetch(`${URL_}?link=1`, { method: 'DELETE' });
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <form onSubmit={add} className="flex gap-2 flex-1 max-w-xl">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username or instagram.com/username"
            className="flex-1 h-12 rounded-full bg-card border border-white/[0.07] px-5 text-sm outline-none focus:border-white/[0.2]"
            required
          />
          <button type="submit" disabled={busy !== null} className="h-12 px-5 rounded-full bg-white text-background text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
            <Plus className="w-4 h-4" /> {busy === 'add' ? 'Looking up...' : 'Track'}
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <span className="px-3 py-1.5 rounded-full bg-white/[0.05]">
            via {link.pageName} · @{link.igUsername}{daysLeft != null ? ` · ${daysLeft > 0 ? `${daysLeft} days left` : 'expired'}` : ''}
          </span>
          {daysLeft != null && daysLeft < 10 && <a href="/api/connect/facebook" className="font-bold text-amber-400 hover:underline">Reconnect</a>}
          {data.competitors.length > 0 && (
            <button onClick={refreshAll} disabled={busy !== null} className="inline-flex items-center gap-1 font-bold hover:text-foreground">
              <RefreshCw className={cn('w-3.5 h-3.5', busy === 'refresh' && 'animate-spin')} /> Refresh all
            </button>
          )}
          <button onClick={disconnect} className="hover:text-rose-400">Disconnect</button>
        </div>
      </div>

      {data.competitors.length === 0 ? (
        <p className="text-sm text-muted-foreground p-5 rounded-[24px] border border-dashed border-white/[0.1]">
          Add a competitor above. It must be a Business or Creator account (most brands and creators are). Try 3 to 5 accounts in your niche that are a bit bigger than you.
        </p>
      ) : (
        <>
          <Comparison you={data.you} rivals={data.competitors} />
          <TakeawaysCard />
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {data.competitors.map((c) => <RivalCard key={c.id} row={c} onRemove={() => remove(c)} />)}
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ row, size = 36 }: { row: Row; size?: number }) {
  return (
    <span className="relative rounded-full overflow-hidden bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)] shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ width: size, height: size }}>
      {row.profilePictureUrl ? <Image src={row.profilePictureUrl} alt="" fill unoptimized sizes={`${size}px`} className="object-cover" /> : row.username[0]?.toUpperCase()}
    </span>
  );
}

function Comparison({ you, rivals }: { you: Row[]; rivals: Row[] }) {
  const rows = [...you.map((r) => ({ ...r, mine: true })), ...rivals.map((r) => ({ ...r, mine: false }))];
  const cols: { label: string; get: (r: Row) => number | null; fmt: (n: number) => string }[] = [
    { label: 'Followers', get: (r) => r.followers, fmt: formatNumber },
    { label: 'Posts / week', get: (r) => r.stats?.postsPerWeek ?? null, fmt: (n) => n.toFixed(1) },
    { label: 'Engagement', get: (r) => r.stats?.engagement ?? null, fmt: (n) => `${n.toFixed(2)}%` },
    { label: 'Avg likes', get: (r) => r.stats?.avgLikes ?? null, fmt: formatNumber },
    { label: 'Avg comments', get: (r) => r.stats?.avgComments ?? null, fmt: formatNumber },
  ];
  const best = cols.map((c) => Math.max(...rows.map((r) => c.get(r) ?? -Infinity)));

  return (
    <section className="rounded-[30px] bg-card border border-white/[0.05] p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-lg font-bold">Head to head</h3>
        <span className="text-[11px] text-muted-foreground">Engagement = likes + comments per follower, the only fair measure for other accounts</span>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-[11px] text-muted-foreground text-left">
              <th className="px-2 py-2 font-bold">Account</th>
              {cols.map((c) => <th key={c.label} className="px-2 py-2 font-bold text-right">{c.label}</th>)}
              <th className="px-2 py-2 font-bold">Top format</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.mine}-${r.username}`} className={cn('border-t border-white/[0.05]', r.mine && 'bg-white/[0.04]')}>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Avatar row={r} size={30} />
                    <span className="font-semibold truncate">@{r.username}</span>
                    {r.mine && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full prism-hero text-white">You</span>}
                  </span>
                </td>
                {cols.map((c, i) => {
                  const v = c.get(r);
                  return (
                    <td key={c.label} className={cn('px-2 py-2.5 text-right tabular-nums', v != null && v === best[i] && rows.length > 1 && 'text-emerald-400 font-bold')}>
                      {v == null ? '—' : c.fmt(v)}
                    </td>
                  );
                })}
                <td className="px-2 py-2.5 text-muted-foreground">{r.stats?.formatMix[0] ? `${formatLabel(r.stats.formatMix[0].type)} ${r.stats.formatMix[0].share}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TakeawaysCard() {
  const url = '/api/ai/competitors';
  const { data: cached } = useCachedJson<Takeaways>(url);
  const [fresh, setFresh] = useState<Takeaways>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: string; code?: string } | null>(null);
  const result = fresh ?? cached ?? null;

  const generate = async () => {
    setBusy(true);
    setFailure(null);
    const res = await fetch(url, { method: 'POST' });
    const body = await res.json().catch(() => ({ error: 'The AI took too long. Try again.' }));
    if (res.ok) {
      setFresh(body);
      primeJson(url, body);
    } else setFailure(body);
    setBusy(false);
  };

  const t = result?.takeaways;
  return (
    <section className="rounded-[30px] bg-white text-[#0A0A0F] p-5 sm:p-7 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-bold prism-text">What to steal, what to skip</span>
        <button onClick={generate} disabled={busy} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#0A0A0F] text-white text-[13px] font-bold disabled:opacity-60">
          <Sparkles className={cn('w-4 h-4', busy && 'animate-spin')} /> {busy ? 'Comparing...' : t ? 'Refresh' : 'Compare with AI'}
        </button>
      </div>
      {failure && <AiNotice code={failure.code} message={failure.error} />}
      {!t ? (
        <p className="font-display font-extrabold text-[22px] leading-tight">Let the AI read their numbers against yours and pull out ideas worth borrowing.</p>
      ) : (
        <>
          <p className="font-display font-extrabold text-[22px] leading-tight">{t.summary}</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#F4F4F8] p-4">
              <p className="text-[12px] font-bold text-rose-600 mb-2">They do better</p>
              {t.theyDoBetter?.map((x) => <p key={x.title} className="text-[13px] mb-2"><b>{x.title}.</b> <span className="text-[#4A4A5A]">{x.detail}</span></p>)}
            </div>
            <div className="rounded-2xl bg-[#F4F4F8] p-4">
              <p className="text-[12px] font-bold text-emerald-600 mb-2">You do better</p>
              {t.youDoBetter?.map((x) => <p key={x.title} className="text-[13px] mb-2"><b>{x.title}.</b> <span className="text-[#4A4A5A]">{x.detail}</span></p>)}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {t.steal?.map((x) => (
              <div key={x.idea} className="rounded-2xl border border-[#E4E4EC] p-4">
                <p className="text-[11px] font-bold text-[#7B61FF]">Borrow from {x.from}</p>
                <p className="font-bold text-[15px] leading-snug mt-1">{x.idea}</p>
                <p className="text-[12px] text-[#4A4A5A] mt-1 leading-snug">{x.how}</p>
              </div>
            ))}
          </div>
          {t.avoid?.length > 0 && <p className="text-[13px] text-[#4A4A5A]"><b className="text-[#0A0A0F]">Don&apos;t copy:</b> {t.avoid.join(' · ')}</p>}
          <p className="text-[11px] text-[#8A8A9C]">{result?.model} · {formatRelativeTime(result!.createdAt).toLowerCase()}</p>
        </>
      )}
    </section>
  );
}

function RivalCard({ row, onRemove }: { row: Row; onRemove: () => void }) {
  const s = row.stats;
  const top = [...(row.posts ?? [])].sort((a, b) => (b.likes ?? b.comments) - (a.likes ?? a.comments)).slice(0, 3);
  return (
    <div className="rounded-[30px] bg-card border border-white/[0.05] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar row={row} size={44} />
        <div className="min-w-0 flex-1">
          <a href={`https://www.instagram.com/${row.username}/`} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline truncate block">@{row.username}</a>
          <p className="text-[12px] text-muted-foreground truncate">{row.name ?? ''} · {formatNumber(row.followers)} followers</p>
        </div>
        <button onClick={onRemove} className="p-2 rounded-full text-muted-foreground hover:text-rose-400 hover:bg-white/[0.06]" aria-label={`Stop tracking @${row.username}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {row.error && <p className="text-[12px] text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2">Last refresh failed: {row.error}</p>}
      {row.biography && <p className="text-[12px] text-muted-foreground line-clamp-2">{row.biography}</p>}

      {s && (
        <>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-white/[0.05]" title="Format mix of their last 30 posts">
            {s.formatMix.map((f, i) => <span key={f.type} style={{ width: `${f.share}%` }} className={['bg-[#FF6B9A]', 'bg-[#4CC9F0]', 'bg-[#FFE066]', 'bg-[#4ADE9E]'][i % 4]} />)}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {s.formatMix.map((f) => <span key={f.type}>{formatLabel(f.type)} {f.share}%{f.avgEngagement != null ? ` · ${f.avgEngagement}% eng` : ''}</span>)}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'posts / week', value: s.postsPerWeek.toFixed(1) },
              { label: 'engagement', value: s.engagement != null ? `${s.engagement}%` : 'hidden' },
              { label: 'best day', value: s.bestDay ?? '—' },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.05] py-2">
                <p className="font-display font-extrabold text-[18px]">{x.value}</p>
                <p className="text-[10px] text-muted-foreground">{x.label}</p>
              </div>
            ))}
          </div>
          {s.likesHidden && <p className="text-[11px] text-muted-foreground">They hide like counts, so engagement is comments only.</p>}
          {s.topHashtags.length > 0 && <p className="text-[11px] text-muted-foreground truncate">{s.topHashtags.join(' ')}</p>}
        </>
      )}

      {top.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-auto">
          {top.map((p) => (
            <a key={p.id} href={p.permalink ?? '#'} target="_blank" rel="noopener noreferrer" className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)]" title={p.caption}>
              {p.image && <Image src={p.image} alt="" fill unoptimized sizes="120px" className="object-cover transition-transform duration-500 group-hover:scale-[1.06]" />}
              {!p.image && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white/90">{formatLabel(p.type)}</span>}
              <span className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[10px] font-bold text-white flex gap-2">
                {p.likes != null && <span className="inline-flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{formatNumber(p.likes)}</span>}
                <span className="inline-flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" />{formatNumber(p.comments)}</span>
              </span>
              <ExternalLink className="absolute top-1.5 right-1.5 w-3 h-3 text-white/80 opacity-0 group-hover:opacity-100" />
            </a>
          ))}
        </div>
      )}
      {row.lastSyncedAt && <p className="text-[10px] text-muted-foreground">Updated {formatRelativeTime(row.lastSyncedAt).toLowerCase()}</p>}
    </div>
  );
}
