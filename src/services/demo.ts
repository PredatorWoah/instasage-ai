import { prisma } from '@/lib/prisma';
import { presetKit } from '@/lib/brandKit';
import { DEMO_ID, DEMO_PROFILE_ID } from '@/lib/demo';
import { PERIOD_PRESETS } from '@/lib/period';
import type { Briefing, GamePlan, Insight, AiRecommendation, PostAnalysis } from '@/services/ai';
import type { Mined } from '@/services/questions';

// The demo account's data: a made-up skincare brand with three months of posts, a plan, ideas,
// drafts and saved AI examples. Rebuilt at most once a day, on demo login, so dates stay current.

const SEEDED_KEY = 'demo:seededAt';
const REBUILD_AFTER_MS = 20 * 3_600_000;
const DAY = 86_400_000;
const TZ = 'Asia/Kolkata';

// Same numbers every time, so the demo always tells the same story
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// [opening line, how well it does against the usual, type]
const HOOKS: [string, number, string][] = [
  ['Pimple chala gaya, par mark reh gaya? 👀', 2.3, 'reel'],
  ['The pimple is gone, but the dark mark stayed?', 2.0, 'reel'],
  ['Why does your skin barrier keep breaking?', 1.7, 'carousel'],
  ['Kya aap serum galat laga rahe ho?', 1.9, 'reel'],
  ['3 mistakes that make acne marks darker', 1.6, 'carousel'],
  ['Your skin has different needs. Your serum should too! 💜', 1.0, 'post'],
  ['New launch alert', 0.5, 'post'],
  ['Happy Diwali from all of us', 0.45, 'post'],
  ['Glow like never before with our must-have serum', 0.55, 'post'],
  ['Dehydrated skin vs dry skin: do you know the difference?', 1.5, 'carousel'],
  ['Stop scrubbing your acne marks', 1.7, 'reel'],
  ['Sunscreen ke bina serum? Mat karo yeh galti', 2.0, 'reel'],
  ['Our bestseller is back in stock', 0.6, 'post'],
  ['Monday motivation for your skin', 0.5, 'post'],
  ['How many drops of serum do you really need?', 1.4, 'reel'],
  ['Niacinamide explained in 20 seconds', 1.3, 'reel'],
  ['Meet the team behind the bottle', 0.6, 'post'],
  ['Oily skin ko bhi hydration chahiye, yeh kyun?', 1.8, 'reel'],
  ['PIH is not a scar. Here is the difference', 1.9, 'carousel'],
  ['Weekend sale is live', 0.5, 'post'],
];
const GOOD_BODY = 'Dark marks after acne are often post-inflammatory hyperpigmentation. A gentle routine and daily sunscreen help the look of marks fade over a few weeks.';
const PLAIN_BODY = 'Shop now and get glowing skin. Limited offer, link in bio.';

async function isFresh() {
  const row = await prisma.appConfig.findUnique({ where: { key: SEEDED_KEY } });
  const profile = await prisma.socialProfile.findUnique({ where: { id: DEMO_PROFILE_ID }, select: { id: true } });
  return !!row && !!profile && Date.now() - Date.parse(row.value) < REBUILD_AFTER_MS;
}

// Called on demo login. Cheap when the data is already fresh.
export async function ensureDemo() {
  await prisma.user.upsert({
    where: { id: DEMO_ID },
    update: { setupDismissed: true },
    create: {
      id: DEMO_ID,
      setupDismissed: true,
      name: 'Demo creator',
      timezone: TZ,
      timezoneAuto: false,
      creatorProfile: { niche: 'Skincare for Indian skin', audience: 'Young adults dealing with acne marks and dryness', goals: 'Grow to 6K followers and sell more serums', postsPerWeek: 3, voice: 'Warm, honest, a little Hinglish', language: 'English with some Hinglish' },
      goal: { target: 6000, deadline: new Date(Date.now() + 75 * DAY).toISOString().slice(0, 10) },
    },
  });
  if (await isFresh()) return;
  await wipe();
  await seed();
  const value = new Date().toISOString();
  await prisma.appConfig.upsert({ where: { key: SEEDED_KEY }, create: { key: SEEDED_KEY, value }, update: { value } });
}

async function wipe() {
  const where = { userId: DEMO_ID };
  await prisma.$transaction([
    prisma.scheduledPost.deleteMany({ where }),
    prisma.creativeDraft.deleteMany({ where }),
    prisma.savedIdea.deleteMany({ where }),
    prisma.aiResult.deleteMany({ where }),
    prisma.brandKit.deleteMany({ where }),
    prisma.sageAction.deleteMany({ where }),
    prisma.ideaThread.deleteMany({ where }),
    prisma.socialProfile.deleteMany({ where }), // posts, metrics and snapshots go with it
    prisma.appConfig.deleteMany({ where: { OR: ['questions:demo:', 'sagechat:demo', 'planchat:demo:', 'planprev:demo:', 'memory:demo', 'weekly:sent:demo', 'igscopes:demo'].map((k) => ({ key: { startsWith: k } })) } }),
  ]);
}

async function seed() {
  const now = Date.now();
  const r = rng(42);

  await prisma.socialProfile.create({
    data: {
      id: DEMO_PROFILE_ID, userId: DEMO_ID, platform: 'instagram', externalId: null, username: 'lumen.skin.demo', displayName: 'Lumen Skin (demo)',
      profilePictureUrl: '', followerCount: 4820, isConnected: true, lastSyncedAt: new Date(now - 40 * 60_000), accessToken: null,
      reach30: 18_400,
      funnel: { profileViews: 2140, linkTaps: 312, follows: 386, unfollows: 92, accountsEngaged: 1930, at: new Date().toISOString() },
      audience: {
        age: [{ label: '18-24', value: 41 }, { label: '25-34', value: 37 }, { label: '13-17', value: 9 }, { label: '35-44', value: 9 }, { label: '45-54', value: 4 }],
        gender: [{ label: 'F', value: 78 }, { label: 'M', value: 21 }, { label: 'U', value: 1 }],
        country: [{ label: 'IN', value: 88 }, { label: 'AE', value: 4 }, { label: 'US', value: 3 }, { label: 'GB', value: 2 }, { label: 'NP', value: 1 }],
        city: [{ label: 'Mumbai, Maharashtra', value: 14 }, { label: 'Delhi, Delhi', value: 12 }, { label: 'Bengaluru, Karnataka', value: 9 }, { label: 'Pune, Maharashtra', value: 6 }, { label: 'Hyderabad, Telangana', value: 5 }],
      },
    },
  });

  // 36 posts over about 12 weeks, 7 PM or so Indian time
  const posts = Array.from({ length: 36 }, (_, n) => {
    const [hook, mult, type] = HOOKS[n % HOOKS.length];
    const views = Math.round(1500 * mult * (0.8 + r() * 0.4));
    const good = mult > 1.2;
    const at = new Date(now - (n * 2.35 + 0.6) * DAY);
    at.setUTCHours(13 + Math.floor(r() * 3), Math.floor(r() * 60), 0, 0);
    const tags = good ? (n % 2 ? '#acnemarks #pih #indianskincare' : '#skinbarrier #hydratingserum #skincaretips') : '#sale #offer #shopnow';
    const reach = Math.round(views * (0.72 + r() * 0.1));
    const likes = Math.round(views * (good ? 0.055 : 0.035));
    const saves = Math.round(views * (good ? 0.03 : 0.006));
    const shares = Math.round(views * (good ? 0.011 : 0.003));
    const comments = Math.round(3 + r() * (good ? 14 : 5));
    return {
      id: `demo-post-${n}`, socialProfileId: DEMO_PROFILE_ID, platform: 'instagram', type, thumbnail: '', permalink: null,
      caption: `${hook}\n\n${good ? GOOD_BODY : PLAIN_BODY}\n\n${tags}`,
      views, reach, likes, comments, saves, shares, performanceScore: ((likes + comments + saves + shares) / reach) * 100,
      publishedAt: at, avgWatchMs: type === 'reel' ? Math.round((good ? 9000 : 5200) + r() * 3000) : null, skipRate: type === 'reel' ? Math.round((good ? 38 : 55) + r() * 8) : null,
    };
  });
  await prisma.post.createMany({ data: posts, skipDuplicates: true });

  // Growth curves for the newest three posts
  const snaps = posts.slice(0, 3).flatMap((p) => [1, 3, 6, 12, 24, 36, 48, 72].filter((h) => p.publishedAt.getTime() + h * 3_600_000 < now).map((h) => {
    const f = Math.min(1, Math.log1p(h) / Math.log1p(72));
    return { id: `${p.id}:${h}`, postId: p.id, hours: h, views: Math.round(p.views * f), reach: Math.round(p.reach * f), likes: Math.round(p.likes * f), comments: Math.round(p.comments * f), saves: Math.round(p.saves * f), shares: Math.round(p.shares * f) };
  }));
  await prisma.postSnapshot.createMany({ data: snaps, skipDuplicates: true });

  // 90 days of followers and reach
  const metrics = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(now - i * DAY);
    const key = d.toISOString().slice(0, 10);
    return { id: `${DEMO_PROFILE_ID}:${key}`, socialProfileId: DEMO_PROFILE_ID, date: new Date(`${key}T12:00:00Z`), followers: Math.round(4820 - i * 10.5 - Math.sin(i / 3) * 6), reach: Math.round(520 + Math.sin(i / 2.5) * 140 + (i % 7 === 2 ? 380 : 0)), postsCount: 36 - Math.floor(i / 2.35) };
  });
  await prisma.metric.createMany({ data: metrics, skipDuplicates: true });

  // Ideas: some on the calendar this week, some on the board
  const at = (days: number, hour: number) => {
    const d = new Date(now + days * DAY);
    d.setUTCHours(hour - 5, 30, 0, 0); // hour is Indian time
    return d;
  };
  await prisma.savedIdea.createMany({
    data: [
      { userId: DEMO_ID, title: 'Reel: why the dark mark stays after a pimple', format: 'reel', status: 'planned', source: 'plan', scheduledFor: at(1, 19), notes: 'Hook: Pimple gaya, mark kyun nahi?', drafts: { caption: 'Pimple gaya, mark kyun nahi? 👀\n\nThat mark is often PIH. Sunscreen every day helps it fade faster.\n\nSave this for later.\n\n#acnemarks #pih #indianskincare' } },
      { userId: DEMO_ID, title: 'Carousel: dehydrated vs dry skin', format: 'carousel', status: 'planned', source: 'plan', scheduledFor: at(3, 19) },
      { userId: DEMO_ID, title: 'Reel: how many drops of serum, really', format: 'reel', status: 'planned', source: 'brainstorm', scheduledFor: at(5, 20) },
      { userId: DEMO_ID, title: 'Sunscreen myths, in Hinglish', format: 'reel', status: 'idea', source: 'brainstorm' },
      { userId: DEMO_ID, title: 'Answer: can teens use niacinamide?', format: 'carousel', status: 'idea', source: 'recommendation' },
      { userId: DEMO_ID, title: 'Before and after: 4 weeks of sunscreen', format: 'carousel', status: 'idea', source: 'manual' },
      { userId: DEMO_ID, title: 'PIH is not a scar', format: 'carousel', status: 'posted', source: 'plan', postId: 'demo-post-18' },
    ],
  });

  // Brand kit
  const kit = presetKit('skincare');
  await prisma.brandKit.create({
    data: {
      userId: DEMO_ID, socialProfileId: DEMO_PROFILE_ID,
      data: { ...kit, brandName: 'Lumen Skin', voice: 'Warm, honest skincare friend for Indian skin. Explains the why simply, mixes in Hinglish, never promises miracles.', products: [{ id: 'p1', name: 'Clear Fade Serum', notes: '30 ml. For oily, acne-prone skin. Helps the look of acne marks.' }, { id: 'p2', name: 'Dew Barrier Serum', notes: '30 ml. For dry and sensitive skin. Helps skin look plumper.' }], ctas: ['Save this for later.', 'Shop the serum, link in bio.', 'Tell us your skin type in the comments.'], context: 'Code FIRST10 gives 10% off the first order.\nFree shipping above ₹999.' } as object,
    },
  });

  // Saved drafts that became posts, with the forecast made before posting: the Scorecard grades these
  const drafts: { post: (typeof posts)[number]; format: string; predicted: number; spread: number }[] = [
    { post: posts[3], format: 'reel', predicted: 2700, spread: 0.2 },
    { post: posts[5], format: 'caption', predicted: 1700, spread: 0.25 },
    { post: posts[10], format: 'reel', predicted: 2300, spread: 0.2 },
    { post: posts[14], format: 'reel', predicted: 1900, spread: 0.22 },
  ];
  await prisma.creativeDraft.createMany({
    data: [
      ...drafts.map((d, i) => ({
        userId: DEMO_ID, socialProfileId: DEMO_PROFILE_ID, kind: 'caption', title: d.post.caption.split('\n')[0], postId: d.post.id,
        data: { format: d.format, body: d.post.caption.split('\n\n').slice(0, 2).join('\n'), hashtags: d.post.caption.split('\n\n')[2] ?? '', cta: 'Save this for later.', predicted: { views: d.predicted, low: Math.round(d.predicted * (1 - d.spread)), high: Math.round(d.predicted * (1 + d.spread)), base: 1700, basis: [{ label: 'Hook style: opens with a question', effect: 15 }], posts: 30, at: new Date(d.post.publishedAt.getTime() - (i + 1) * 3_600_000).toISOString() } },
      })),
      { userId: DEMO_ID, socialProfileId: DEMO_PROFILE_ID, kind: 'caption', title: 'Sunscreen ke bina serum? Mat karo yeh galti', data: { format: 'reel', body: 'Sunscreen ke bina serum? Mat karo yeh galti\nSerum helps the look of marks, sunscreen stops new ones. You need both.', hashtags: '#acnemarks #indianskincare', cta: 'Save this for later.' } },
    ],
  });

  // One post sent from InstaSage
  await prisma.scheduledPost.create({ data: { userId: DEMO_ID, socialProfileId: DEMO_PROFILE_ID, kind: 'reel', caption: posts[0].caption, media: [], status: 'published', mediaId: posts[0].id, publishedAt: posts[0].publishedAt, scheduledFor: posts[0].publishedAt } });

  // Saved AI examples, for every time window and for "all accounts" and the account itself
  const keys = ['all', DEMO_PROFILE_ID];
  const windows = [...PERIOD_PRESETS.map(String), 'all'];
  const rows: { userId: string; kind: string; content: object; model: string }[] = [];
  for (const k of keys) {
    rows.push({ userId: DEMO_ID, kind: `plan:${k}`, content: PLAN, model: 'demo example' });
    for (const w of windows) {
      rows.push({ userId: DEMO_ID, kind: `briefing:${k}@${w}`, content: BRIEFING, model: 'demo example' });
      rows.push({ userId: DEMO_ID, kind: `insights:${k}@${w}`, content: INSIGHTS, model: 'demo example' });
      rows.push({ userId: DEMO_ID, kind: `recommendations:${k}@${w}`, content: RECS, model: 'demo example' });
    }
  }
  for (const [i, p] of [posts[0], posts[1], posts[6]].entries()) rows.push({ userId: DEMO_ID, kind: `post:${p.id}`, content: REVIEWS[i], model: 'demo example' });
  await prisma.aiResult.createMany({ data: rows, skipDuplicates: true });

  // Comment questions, a Sage chat and a plan chat
  const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
  const q = (id: string, text: string, username: string, h: number, answered: boolean, post: number) => ({ id, text, username, at: ago(h), likes: Math.round(r() * 4), answered, postId: posts[post].id, postCaption: posts[post].caption.slice(0, 80) });
  const mined: Mined = {
    at: new Date().toISOString(), postsRead: 15, postsFailed: 0, comments: 214, questions: 11, unanswered: 8,
    themes: [
      { key: 'marks', label: 'Marks', questions: [q('q1', 'Does it work on old marks too?', 'riya.glows', 3, false, 0), q('q2', 'Purane marks ke liye kaunsa serum best hai?', 'aman_k', 9, false, 3), q('q3', 'How long till the marks fade?', 'skin.by.neha', 20, true, 0), q('q4', 'Will it help PIH on darker skin?', 'tanvi__', 30, false, 18)] },
      { key: 'sunscreen', label: 'Sunscreen', questions: [q('q5', 'Serum ke baad sunscreen lagana zaroori hai?', 'rahul.s', 5, false, 11), q('q6', 'Which sunscreen goes with this?', 'meera.m', 26, false, 11), q('q7', 'Can I use it in the day?', 'priya_09', 40, true, 14)] },
      { key: 'oily', label: 'Oily', questions: [q('q8', 'Oily skin ke liye chalega?', 'kabir.fit', 6, false, 17), q('q9', 'Will it make my oily skin worse?', 'sana.k', 50, false, 17)] },
      { key: '', label: 'Other questions', questions: [q('q10', 'Do you ship to Dubai?', 'farah.d', 12, false, 5), q('q11', 'Is it safe for teens?', 'ishaan_', 70, true, 15)] },
    ],
  };
  for (const k of keys) await prisma.appConfig.create({ data: { key: `questions:demo:${k}`, value: JSON.stringify(mined) } });
  await prisma.appConfig.create({ data: { key: 'sagechat:demo', value: JSON.stringify([
    { role: 'user', content: 'Which post got the most saves, and why?', at: ago(2) },
    { role: 'assistant', content: 'Your "Pimple chala gaya, par mark reh gaya?" reel. It explains PIH simply and ends with a routine people want to keep, so they save it to come back to. Your educational reels average about 3x the saves of product posts.', at: ago(2) },
  ]) } });
  await prisma.appConfig.create({ data: { key: 'planchat:demo:all', value: JSON.stringify([
    { role: 'user', content: 'I can only post 3 times a week. Rework the schedule.', at: ago(26) },
    { role: 'assistant', content: 'Done: three slots a week, all at 7 PM, two of them reels since reels bring most of your views.', at: ago(26), changes: ['Schedule: 3 posts a week', 'Week 2 trimmed to 3 posts'] },
  ]) } });
}

const PLAN: GamePlan = {
  headline: 'Education reels about acne marks are carrying you. Do more of them, and stop the sale posts.',
  diagnosis: 'Reels that explain a skin concern get about 2x your usual views and 3x the saves. Plain product and sale posts get half your usual views and drag your average down.',
  keep: [
    { title: 'Explain one concern per reel', why: 'Your PIH and barrier reels average +90% views.' },
    { title: 'Hinglish hooks', why: 'Hooks with a little Hinglish do 47% better for you.' },
    { title: 'Open with a question', why: 'Question hooks beat statements by about a third.' },
  ],
  stop: [
    { title: 'Sale and "back in stock" posts', why: 'They get about half your usual views. Put offers in the caption of an education post instead.' },
    { title: 'Generic hashtags like #sale', why: 'Posts with them do 60% worse.' },
  ],
  pillars: [
    { name: 'Acne marks and PIH', description: 'Why marks stay, how they fade, what makes them worse.', share: 45, formats: 'Reels, carousels' },
    { name: 'Skin barrier', description: 'Dry vs dehydrated, over-exfoliating, simple routines.', share: 30, formats: 'Carousels' },
    { name: 'How to use it', description: 'Drops, order of steps, sunscreen with serum.', share: 25, formats: 'Reels' },
  ],
  schedule: [
    { day: 'Tue', time: '7 PM', format: 'reel', why: 'Your best day: reels on Tuesday get +40% views.' },
    { day: 'Thu', time: '7 PM', format: 'carousel', why: 'Carousels collect the most saves mid-week.' },
    { day: 'Sun', time: '8 PM', format: 'reel', why: 'Sunday evening has your highest reach.' },
  ],
  weeks: [
    { week: 1, theme: 'Marks, explained', goal: 'Two posts over 3K views', posts: [{ day: 'Tue', format: 'reel', idea: 'Why the dark mark stays after a pimple', hook: 'Pimple gaya, mark kyun nahi?', basedOn: 'your PIH reel (+130% views)' }, { day: 'Thu', format: 'carousel', idea: '5 things that make marks darker', hook: 'Stop doing these to your acne marks', basedOn: '' }, { day: 'Sun', format: 'reel', idea: 'Sunscreen + serum, in 20 seconds', hook: 'Serum without sunscreen? Mat karo', basedOn: 'your sunscreen reel (+100%)' }] },
    { week: 2, theme: 'Barrier basics', goal: '150 saves in the week', posts: [{ day: 'Tue', format: 'reel', idea: 'Dry vs dehydrated, the 10 second test', hook: 'Is your skin dry or just thirsty?', basedOn: '' }, { day: 'Thu', format: 'carousel', idea: 'A 3-step barrier routine', hook: 'Your barrier is begging for this', basedOn: '' }, { day: 'Sun', format: 'reel', idea: 'Over-exfoliating: the signs', hook: 'Stinging after toner? Read this', basedOn: '' }] },
    { week: 3, theme: 'Your questions', goal: 'Answer the 3 most asked comment questions', posts: [{ day: 'Tue', format: 'reel', idea: 'Does it work on old marks?', hook: 'Purane marks bhi jaayenge?', basedOn: '11 comment questions' }, { day: 'Thu', format: 'carousel', idea: 'Oily skin and serums', hook: 'Oily skin ko bhi hydration chahiye', basedOn: '' }, { day: 'Sun', format: 'reel', idea: 'How long until marks fade', hook: 'Week 1 vs week 6', basedOn: '' }] },
    { week: 4, theme: 'Proof', goal: 'Reach 5,200 followers', posts: [{ day: 'Tue', format: 'reel', idea: 'A 4-week sunscreen diary', hook: '28 days of sunscreen, honestly', basedOn: '' }, { day: 'Thu', format: 'carousel', idea: 'Myths about acne marks', hook: 'Toothpaste on a pimple? No.', basedOn: '' }, { day: 'Sun', format: 'reel', idea: 'Your routine, rated', hook: 'Rating your routines', basedOn: '' }] },
  ],
  experiments: [
    { title: 'Hinglish-only hook', hypothesis: 'A fully Hinglish first line beats a mixed one.', how: 'Two similar reels in week 1, one hook each way.', measure: 'Views at 24 hours' },
    { title: 'Offer in the caption', hypothesis: 'An education post with FIRST10 in the caption sells as well as a sale post, without the view drop.', how: 'Add the code to one education post.', measure: 'Link taps' },
  ],
  targets: [
    { metric: 'Followers', now: '4.8K', target: '5.2K' },
    { metric: 'Avg views per reel', now: '2.6K', target: '3.2K' },
    { metric: 'Saves per week', now: '210', target: '300' },
  ],
};

const BRIEFING: Briefing = {
  headline: 'Your PIH reel is still pulling views two days later. Ride it this week.',
  win: 'The "Pimple chala gaya" reel is at 2.3x your usual views, with 90 saves.',
  watch: 'Sale posts keep landing at half your usual reach. Skip them this week.',
  move: { format: 'reel', when: 'Tuesday 7 PM', idea: 'A follow-up: how long marks take to fade', hook: 'Week 1 vs week 6: how fast marks really fade', basedOn: 'your PIH reel' },
};

const INSIGHTS: Insight[] = [
  { title: 'Education reels double your views', description: 'Reels that explain a concern average 3.1K views against 1.6K for everything else, and 3x the saves.', impact: 'high', category: 'content' },
  { title: 'Hinglish hooks win', description: 'Posts that open in Hinglish get 47% more views over 8 posts.', impact: 'high', category: 'engagement' },
  { title: 'Sale posts cost you reach', description: 'Posts with #sale or "shop now" get 61% fewer views. Six of them in the last 90 days.', impact: 'medium', category: 'content' },
  { title: 'Tuesday 7 PM is your slot', description: 'Tuesday evening posts get 40% more views than your average.', impact: 'medium', category: 'timing' },
];

const RECS: AiRecommendation[] = [
  { id: 'rec-0', title: 'Make a follow-up to the PIH reel', description: 'It is at 2.3x your usual views. A follow-up on how long marks take to fade rides the same interest.', priority: 'high', category: 'content', impact: 'One reel over 3K views', effort: 'low', estimatedGrowth: '+10% reach' },
  { id: 'rec-1', title: 'Answer the top comment question', description: '"Does it work on old marks?" was asked 4 times this week. A 20 second reel answers all of them.', priority: 'high', category: 'engagement', impact: 'More comments and saves', effort: 'low', estimatedGrowth: '+15% saves' },
  { id: 'rec-2', title: 'Drop the sale posts this week', description: 'They average half your views. Put FIRST10 in the caption of an education post instead.', priority: 'medium', category: 'growth', impact: 'Steadier reach', effort: 'low', estimatedGrowth: '+5% reach' },
];

const REVIEWS: PostAnalysis[] = [
  { verdict: 'A winner: a clear question hook and a real explanation, which people save to come back to.', whyItPerformed: ['The Hinglish question hook stops the scroll in the first second.', 'It explains PIH in plain words, so it is worth saving.'], improve: ['Show the product on skin earlier.', 'End with one CTA, not two.'], nextPostIdeas: ['How long marks take to fade', 'PIH on darker skin'], bestFor: 'Saves' },
  { verdict: 'Strong: the question hook works, and the topic is what your audience asks about most.', whyItPerformed: ['Same concern as your best reel, new angle.'], improve: ['The first 2 seconds are text only; add movement.'], nextPostIdeas: ['Old marks vs new marks'], bestFor: 'Reach' },
  { verdict: 'Weak: a launch post with no reason to stop scrolling.', whyItPerformed: ['"New launch alert" says nothing about the viewer.', 'Generic hashtags.'], improve: ['Lead with the problem it solves.', 'Use your proven hashtags.'], nextPostIdeas: ['Relaunch as "the serum for marks that will not fade"'], bestFor: 'Nothing yet' },
];
