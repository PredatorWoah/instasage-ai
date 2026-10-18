'use client';

import dynamic from 'next/dynamic';

// The chart library is the heaviest thing on the page, so charts load after the page is usable,
// with a placeholder of the same height so nothing jumps
const Placeholder = ({ height = 200 }: { height?: number }) => <div style={{ height }} className="rounded-2xl bg-ink/[0.03] animate-pulse" />;

export const FollowersChart = dynamic(() => import('./AllCharts').then((m) => m.FollowersChart), { ssr: false, loading: () => <Placeholder /> });
export const EngagementChart = dynamic(() => import('./AllCharts').then((m) => m.EngagementChart), { ssr: false, loading: () => <Placeholder /> });
export const ViewsChart = dynamic(() => import('./AllCharts').then((m) => m.ViewsChart), { ssr: false, loading: () => <Placeholder /> });
export const ReachChart = dynamic(() => import('./AllCharts').then((m) => m.ReachChart), { ssr: false, loading: () => <Placeholder /> });
export const PostingFrequencyChart = dynamic(() => import('./AllCharts').then((m) => m.PostingFrequencyChart), { ssr: false, loading: () => <Placeholder /> });
