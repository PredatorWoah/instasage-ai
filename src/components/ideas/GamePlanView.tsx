'use client';

import { useEffect, useState } from 'react';
import { BookmarkPlus, CalendarDays, Check, FlaskConical, Layers, Rocket, Target, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { GamePlan } from '@/services/ai';
import { primeJson, useCachedJson } from '@/lib/useCachedJson';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { GeneratedAt } from '@/components/ai-assistant/GeneratedAt';
import { SageOrb } from '@/components/ai-assistant/SageOrb';
import { saveIdea } from './saveIdea';
import { cn } from '@/lib/utils';

type Cached = { plan: GamePlan; model: string; createdAt: string } | null;
const PLAN_URL = '/api/ai/plan';

const THINKING = [
  'Comparing your formats head to head...',
  'Finding your best days and hours...',
  'Checking which captions and titles pull views...',
  'Spotting what is dragging you down...',
  'Writing four weeks of posts...',
  'Setting targets you can actually hit...',
];

const PILLAR_COLORS = ['prism-sunset', 'prism-ocean', 'prism-gold', 'prism-hero'];

export function GamePlanView() {
  const { data: cached } = useCachedJson<Cached>(PLAN_URL);
  const [fresh, setFresh] = useState<Cached>(null);
  const [generating, setGenerating] = useState(false);
  const [failure, setFailure] = useState<{ error: string; code?: string } | null>(null);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setStep((s) => (s + 1) % THINKING.length), 3500);
    return () => clearInterval(t);
  }, [generating]);

  const generate = async () => {
    setGenerating(true);
    setFailure(null);
    setStep(0);
    const res = await fetch(PLAN_URL, { method: 'POST' });
    const data = await res.json().catch(() => ({ error: 'The AI took too long or sent back something unexpected. Try again.' }));
    if (res.ok) {
      setFresh(data);
      primeJson(PLAN_URL, data);
    } else setFailure(data);
    setGenerating(false);
  };

  const result = fresh ?? cached ?? null;
  const plan = result?.plan;

  const keep = async (key: string, idea: { title: string; notes: string; format?: string }) => {
    if (saved[key]) return;
    if (await saveIdea({ ...idea, source: 'plan' })) setSaved((s) => ({ ...s, [key]: true }));
  };

  if (cached === undefined) return <div className="h-72 rounded-[30px] bg-card animate-pulse" />;

  if (generating && !plan) return <Thinking step={step} />;

  if (!plan) {
    return (
      <div className="space-y-4">
        {failure && <AiNotice code={failure.code} message={failure.error} />}
        <section className="relative overflow-hidden rounded-[34px] prism-hero p-7 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-6">
          <div aria-hidden className="absolute -right-20 -top-28 w-[380px] h-[380px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.5),transparent)]" />
          <div className="relative flex-1 space-y-3">
            <h2 className="text-[32px] sm:text-[44px] leading-[0.98] tracking-[-0.045em]">Your next 30 days, planned from your own numbers.</h2>
            <p className="text-white/85 text-[15px] max-w-[560px]">
              What to keep, what to stop, the days and times that work for you, content pillars, four weeks of post ideas with hooks, experiments and targets.
            </p>
          </div>
          <button
            onClick={generate}
            className="relative self-start sm:self-center inline-flex items-center gap-2 h-12 px-6 rounded-full bg-white text-[#0A0A0F] font-bold text-sm hover:scale-[1.03] active:scale-[0.97] transition-transform"
          >
            <Rocket className="w-4 h-4" /> Build my game plan
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GeneratedAt createdAt={result?.createdAt} model={result?.model} generating={generating} onRegenerate={generate} />
      </div>
      {failure && <AiNotice code={failure.code} message={failure.error} />}
      {generating && <p className="text-xs text-muted-foreground text-right animate-pulse">{THINKING[step]}</p>}

      {/* Where you stand */}
      <section className="animate-rise relative overflow-hidden rounded-[34px] prism-hero p-7 sm:p-9">
        <div aria-hidden className="absolute right-[10%] -top-32 w-[380px] h-[380px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.45),transparent)]" />
        <div className="relative grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-chip text-[13px] font-bold">30-day game plan</span>
            <h2 className="text-[30px] sm:text-[44px] leading-[1] tracking-[-0.045em] text-balance">{plan.headline}</h2>
            <p className="text-white/90 text-[15px] leading-relaxed max-w-[720px]">{plan.diagnosis}</p>
          </div>
          {plan.targets?.length > 0 && (
            <div className="flex flex-col gap-2">
              {plan.targets.map((t) => (
                <div key={t.metric} className="px-4 py-3 rounded-[20px] glass-chip">
                  <p className="text-[12px] font-bold text-white/80 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> {t.metric}</p>
                  <p className="text-[15px] font-bold"><span className="text-white/70 font-medium">{t.now}</span> → <span className="font-display font-extrabold text-[20px]">{t.target}</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Do's and don'ts */}
      <section className="stagger grid md:grid-cols-2 gap-4">
        <ListCard title="Keep doing" icon={ThumbsUp} tone="text-emerald-400 bg-emerald-500/10" items={plan.keep} />
        <ListCard title="Stop doing" icon={ThumbsDown} tone="text-rose-400 bg-rose-500/10" items={plan.stop} />
      </section>

      {/* Pillars + schedule */}
      <section className="stagger grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" /> Content pillars</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {plan.pillars?.map((p, i) => (
              <div key={p.name} className={cn('rounded-[22px] p-4 flex flex-col gap-2', PILLAR_COLORS[i % PILLAR_COLORS.length], i % 4 === 1 || i % 4 === 2 ? 'text-[#0A0A0F]' : 'text-white')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display font-extrabold text-[18px] leading-tight">{p.name}</p>
                  <span className="font-display font-extrabold text-[22px] leading-none">{Math.round(Number(p.share) || 0)}%</span>
                </div>
                <p className="text-[13px] leading-snug opacity-90">{p.description}</p>
                <p className="text-[11px] font-bold opacity-75">{p.formats}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-muted-foreground" /> Posting slots</h3>
          {plan.schedule?.map((s, i) => (
            <div key={i} className="flex gap-3 items-start p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="w-14 shrink-0 text-center">
                <p className="font-display font-extrabold text-[18px] leading-none">{s.day}</p>
                <p className="text-[11px] text-muted-foreground mt-1 whitespace-nowrap">{s.time}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold capitalize">{s.format}</p>
                <p className="text-[12px] text-muted-foreground leading-snug">{s.why}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Week by week */}
      <section className="rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] space-y-4">
        <h3 className="text-lg font-bold">Week by week</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          {plan.weeks?.map((w) => (
            <div key={w.week} className="rounded-[24px] p-4 bg-white/[0.03] border border-white/[0.06] flex flex-col gap-3">
              <div>
                <p className="text-[12px] font-bold prism-text">Week {w.week}</p>
                <p className="font-display font-extrabold text-[18px] leading-tight">{w.theme}</p>
                <p className="text-[12px] text-muted-foreground mt-1">{w.goal}</p>
              </div>
              <div className="flex flex-col gap-2">
                {w.posts?.map((p, i) => {
                  const key = `${w.week}-${i}`;
                  return (
                    <div key={key} className="group rounded-2xl p-3 bg-background/60 border border-white/[0.05]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground">{p.day} · <span className="capitalize">{p.format}</span></span>
                        <button
                          onClick={() => keep(key, { title: p.idea, notes: `Hook: ${p.hook}\nWeek ${w.week}: ${w.theme}`, format: p.format })}
                          className={cn('p-1 rounded-full transition-colors', saved[key] ? 'text-emerald-400' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.08]')}
                          aria-label={saved[key] ? 'Saved to board' : 'Save to idea board'}
                          title={saved[key] ? 'Saved to board' : 'Save to idea board'}
                        >
                          {saved[key] ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[13px] font-semibold leading-snug mt-1">{p.idea}</p>
                      <p className="text-[12px] text-muted-foreground mt-1 italic leading-snug">&ldquo;{p.hook}&rdquo;</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Experiments */}
      {plan.experiments?.length > 0 && (
        <section className="stagger grid md:grid-cols-3 gap-4">
          {plan.experiments.map((x) => (
            <div key={x.title} className="rounded-[30px] p-5 bg-white text-[#0A0A0F] flex flex-col gap-2">
              <span className="text-[12px] font-bold prism-text flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5 text-[#7B61FF]" /> Experiment</span>
              <p className="font-display font-extrabold text-[20px] leading-tight">{x.title}</p>
              <p className="text-[13px] text-[#4A4A5A] leading-snug"><b>Why:</b> {x.hypothesis}</p>
              <p className="text-[13px] text-[#4A4A5A] leading-snug"><b>How:</b> {x.how}</p>
              <p className="text-[12px] font-bold text-[#7B61FF] mt-auto pt-1">Decided by: {x.measure}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function ListCard({ title, icon: Icon, tone, items }: {
  title: string;
  icon: React.ElementType;
  tone: string;
  items: { title: string; why: string }[];
}) {
  return (
    <div className="rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] space-y-3">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <span className={cn('w-8 h-8 rounded-xl flex items-center justify-center', tone)}><Icon className="w-4 h-4" /></span>
        {title}
      </h3>
      {items?.map((item) => (
        <div key={item.title} className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
          <p className="text-sm font-bold">{item.title}</p>
          <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">{item.why}</p>
        </div>
      ))}
    </div>
  );
}

function Thinking({ step }: { step: number }) {
  return (
    <div className="rounded-[34px] bg-card border border-white/[0.05] p-10 flex flex-col items-center text-center gap-5 min-h-[320px] justify-center">
      <SageOrb size={84} />
      <div className="space-y-1">
        <p className="font-display font-extrabold text-[22px]">Building your game plan</p>
        <p key={step} className="text-sm text-muted-foreground animate-rise">{THINKING[step]}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">Takes 20 to 60 seconds, depending on the model.</p>
    </div>
  );
}
