import type { TimeSeriesPoint } from '@/types';

export type Goal = { target: number; deadline?: string };

// Followers gained per day over the window, by least squares on the daily counts
export function followersPerDay(series: TimeSeriesPoint[]) {
  const pts = series.map((p, i) => [i, p.followers] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  const num = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
  const den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  return den ? num / den : null;
}

// Where the goal stands: progress, the date at the current pace, and the pace a deadline needs
export function goalForecast(goal: Goal | null, current: number, perDay: number | null, timeZone: string) {
  if (!goal) return null;
  const now = Date.now();
  const fmt = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
  const remaining = goal.target - current;
  const reached = remaining <= 0;
  const etaDays = !reached && perDay && perDay > 0 ? Math.ceil(remaining / perDay) : null;
  const daysLeft = goal.deadline ? Math.ceil((Date.parse(goal.deadline) - now) / 86_400_000) : null;
  const neededPerDay = !reached && daysLeft && daysLeft > 0 ? remaining / daysLeft : null;
  return {
    ...goal,
    current,
    progress: Math.max(0, Math.min(1, goal.target > 0 ? current / goal.target : 0)),
    reached,
    remaining: Math.max(0, remaining),
    perDay: perDay == null ? null : Number(perDay.toFixed(2)),
    eta: etaDays != null && etaDays < 3650 ? fmt(now + etaDays * 86_400_000) : null,
    etaDays,
    deadlineLabel: goal.deadline ? fmt(Date.parse(goal.deadline)) : null,
    daysLeft,
    neededPerDay: neededPerDay == null ? null : Number(neededPerDay.toFixed(1)),
    onTrack: neededPerDay == null ? null : (perDay ?? 0) >= neededPerDay,
  };
}

export type GoalForecast = NonNullable<ReturnType<typeof goalForecast>>;
