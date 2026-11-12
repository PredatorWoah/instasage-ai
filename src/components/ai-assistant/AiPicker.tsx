'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, ChevronDown, Cpu } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { primeJson, useCachedJson } from '@/lib/useCachedJson';
import { cn } from '@/lib/utils';

export type AiGroup = 'plan' | 'insights' | 'brainstorm' | 'chat' | 'writer' | 'analysis';
type Provider = { id: string; label: string; connected: boolean; model: string | null; models: string[] };
type Status = { active: string | null; providers: Provider[]; routing: Record<string, { provider: string; model?: string }>; groups: { id: string; label: string }[] };

const URL = '/api/settings/ai';
// Every picker on screen re-reads the setting when any one of them changes it
const CHANGED = 'instasage:ai-choice';

// Which AI answers this part of the app, chosen right where you use it. Same setting as
// Settings › AI › Different AI per feature, so both stay in step.
export function useAiChoice(group: AiGroup) {
  const { data, refresh } = useCachedJson<Status | null>(URL);
  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(CHANGED, onChange);
    return () => window.removeEventListener(CHANGED, onChange);
  }, [refresh]);
  const route = data?.routing?.[group];
  const provider = data?.providers.find((p) => p.id === (route?.provider ?? data?.active));
  return { status: data, route, provider, model: route?.model ?? provider?.model ?? null };
}

export function AiPicker({ group, className, compact = false }: { group: AiGroup; className?: string; compact?: boolean }) {
  const { status, route, provider, model } = useAiChoice(group);
  if (status === undefined) return <span className={cn('inline-block h-9 w-28 rounded-full glass-field animate-pulse', className)} aria-hidden />;
  const connected = status?.providers.filter((p) => p.connected) ?? [];
  const groupLabel = status?.groups.find((g) => g.id === group)?.label ?? 'this feature';
  const active = status?.providers.find((p) => p.id === status.active);

  const choose = async (choice: { provider: string; model?: string } | null) => {
    const res = await fetch(URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routing: { [group]: choice } }) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) return toast.error('Could not switch the AI', { description: body?.error ?? 'Try again.' });
    primeJson(URL, body);
    window.dispatchEvent(new Event(CHANGED));
    const p = body.providers.find((x: Provider) => x.id === (choice?.provider ?? body.active));
    toast.success(`${groupLabel}: ${p?.label ?? 'default AI'}`, { description: choice?.model ?? (choice ? 'Its saved model' : 'Back to your default AI') });
  };

  const label = provider ? provider.label : 'No AI key';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={provider ? `${groupLabel}: ${provider.label}${model ? ` · ${model}` : ''}` : 'Add an AI key'}
          aria-label={`AI for ${groupLabel}: ${label}${model ? `, ${model}` : ''}. Change it`}
          className={cn('inline-flex items-center gap-1.5 h-9 px-3 rounded-full glass-field text-[12px] font-bold max-w-[240px] hover:bg-ink/[0.12] transition-colors', className)}
        >
          <Cpu className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
          <span className="truncate">{label}{!compact && model ? <span className="font-medium text-muted-foreground"> · {model.split('/').pop()}</span> : null}</span>
          {route && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" title="Chosen for this feature" />}
          <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground leading-snug">AI for {groupLabel}</DropdownMenuLabel>
        {connected.length === 0 ? (
          <DropdownMenuItem asChild><Link href="/settings#ai" className="text-sm">Add an AI key in Settings</Link></DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => choose(null)} className="text-sm gap-2">
              <span className="flex-1 min-w-0 truncate">Default{active ? ` · ${active.label}` : ''}</span>
              {!route && <Check className="w-3.5 h-3.5 shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {connected.map((p) => {
              const picked = route?.provider === p.id;
              // Current pick first, then the rest; very long lists (OpenRouter) are cut, Settings has them all
              const models = [...new Set([...(picked && route?.model ? [route.model] : []), ...(p.model ? [p.model] : []), ...p.models])].slice(0, 25);
              return (
                <DropdownMenuSub key={p.id}>
                  <DropdownMenuSubTrigger className="text-sm gap-2">
                    <span className="flex-1 min-w-0 truncate">{p.label}</span>
                    {picked && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64 max-h-[60vh] overflow-y-auto">
                    <DropdownMenuItem onClick={() => choose({ provider: p.id })} className="text-[13px] gap-2">
                      <span className="flex-1 min-w-0 truncate">Its saved model{p.model ? ` · ${p.model}` : ''}</span>
                      {picked && !route?.model && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {models.map((m) => (
                      <DropdownMenuItem key={m} onClick={() => choose({ provider: p.id, model: m })} className="text-[13px] gap-2">
                        <span className="flex-1 min-w-0 truncate" title={m}>{m}</span>
                        {picked && route?.model === m && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/settings#ai" className="text-[12px] text-muted-foreground">All AI keys and models</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
