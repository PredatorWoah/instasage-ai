import { KPICard } from './KPICard';
import type { KPIMetric } from '@/types';

type KPIGridProps = {
  metrics: KPIMetric[];
};

export function KPIGrid({ metrics }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {metrics.map((metric) => (
        <KPICard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
