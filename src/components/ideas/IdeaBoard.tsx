'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { Markdown } from './Markdown';
import { SAVED_URL, reloadSaved, type SavedIdea } from './saveIdea';
import { cn } from '@/lib/utils';

const COLUMNS: { id: SavedIdea['status']; title: string; hint: string; dot: string }[] = [
  { id: 'idea', title: 'Ideas', hint: 'Worth making', dot: 'bg-[#FFE066]' },
  { id: 'planned', title: 'Planned', hint: 'Scripted or scheduled', dot: 'bg-[#4CC9F0]' },
  { id: 'posted', title: 'Posted', hint: 'Out in the world', dot: 'bg-[#4ADE9E]' },
];
const SOURCE: Record<SavedIdea['source'], string> = { manual: 'You', plan: 'Game plan', brainstorm: 'Brainstorm', recommendation: 'Quick win' };

export function IdeaBoard() {
  const { data, refresh } = useCachedJson<SavedIdea[]>(SAVED_URL);
  const [ideas, setIdeas] = useState<SavedIdea[] | null>(null);
  const [title, setTitle] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const list = ideas ?? data ?? [];

  const patch = async (id: string, body: Partial<SavedIdea>) => {
    setIdeas(list.map((i) => (i.id === id ? { ...i, ...body } : i)));
    await fetch(`${SAVED_URL}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    reloadSaved();
  };

  const remove = async (id: string) => {
    setIdeas(list.filter((i) => i.id !== id));
    await fetch(`${SAVED_URL}/${id}`, { method: 'DELETE' });
    reloadSaved();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch(SAVED_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, source: 'manual' }) });
    setTitle('');
    setIdeas(null);
    refresh();
  };

  if (data === undefined) return <div className="h-72 rounded-[30px] bg-card animate-pulse" />;

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Jot down an idea before it escapes..."
          className="flex-1 h-12 rounded-full bg-card border border-white/[0.07] px-5 text-sm outline-none focus:border-white/[0.2]"
        />
        <button type="submit" disabled={!title.trim()} className="h-12 px-5 rounded-full bg-white text-background text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      {list.length === 0 && (
        <p className="text-sm text-muted-foreground p-4 rounded-2xl border border-dashed border-white/[0.1]">
          Nothing here yet. Save posts from your game plan, replies from a brainstorm, or add your own above.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col, ci) => {
          const items = list.filter((i) => i.status === col.id);
          return (
            <div key={col.id} className="rounded-[30px] bg-card border border-white/[0.05] p-3 flex flex-col gap-2 min-h-[200px]">
              <div className="flex items-center justify-between px-2 pt-1 pb-2">
                <p className="text-sm font-bold flex items-center gap-2"><span className={cn('w-2.5 h-2.5 rounded-full', col.dot)} /> {col.title}</p>
                <span className="text-[11px] text-muted-foreground">{items.length} · {col.hint}</span>
              </div>
              {items.map((idea) => (
                <div key={idea.id} className="rounded-2xl p-3 bg-white/[0.03] border border-white/[0.06]">
                  <button onClick={() => setOpenId(openId === idea.id ? null : idea.id)} className="text-left w-full">
                    <p className="text-[13px] font-semibold leading-snug">{idea.title}</p>
                  </button>
                  {openId === idea.id && idea.notes && (
                    <div className="mt-2 pt-2 border-t border-white/[0.06] text-muted-foreground [&_p]:text-[13px] [&_li]:text-[13px]">
                      <Markdown text={idea.notes} />
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground">{SOURCE[idea.source] ?? 'You'}</span>
                    {idea.format && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground capitalize">{idea.format}</span>}
                    <span className="ml-auto flex items-center">
                      {ci > 0 && (
                        <button onClick={() => patch(idea.id, { status: COLUMNS[ci - 1].id })} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.08]" aria-label={`Move to ${COLUMNS[ci - 1].title}`}>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {ci < COLUMNS.length - 1 && (
                        <button onClick={() => patch(idea.id, { status: COLUMNS[ci + 1].id })} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.08]" aria-label={`Move to ${COLUMNS[ci + 1].title}`}>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => remove(idea.id)} className="p-1.5 rounded-full text-muted-foreground hover:text-rose-400 hover:bg-white/[0.08]" aria-label="Delete idea">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
