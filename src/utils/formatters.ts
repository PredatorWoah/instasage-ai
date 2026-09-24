export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(dateStr)
  );
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function getPerformanceLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  return 'Below Average';
}

export function getPerformanceColor(score: number): string {
  if (score >= 90) return 'text-emerald-500';
  if (score >= 75) return 'text-blue-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube',
    all: 'All Platforms',
  };
  return labels[platform] ?? platform;
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    facebook: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    youtube: 'bg-red-500/10 text-red-400 border-red-500/20',
    all: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };
  return colors[platform] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}
