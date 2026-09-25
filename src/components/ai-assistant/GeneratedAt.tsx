import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/utils/formatters';

export function GeneratedAt({ createdAt, model, generating, onRegenerate }: {
  createdAt?: string;
  model?: string;
  generating: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex items-center gap-3 self-start shrink-0">
      {createdAt && (
        <span className="text-[11px] text-muted-foreground">
          Generated {formatRelativeTime(createdAt).toLowerCase()}{model ? ` · ${model}` : ''}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={onRegenerate} disabled={generating} className="text-xs h-8 gap-1.5">
        <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
        {generating ? 'Analyzing...' : 'Regenerate'}
      </Button>
    </div>
  );
}
