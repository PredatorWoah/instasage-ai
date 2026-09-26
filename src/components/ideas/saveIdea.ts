'use client';

import { toast } from 'sonner';
import { primeJson } from '@/lib/useCachedJson';

export type SavedIdea = {
  id: string;
  title: string;
  notes: string;
  format: string | null;
  status: 'idea' | 'planned' | 'posted';
  source: 'manual' | 'plan' | 'brainstorm' | 'recommendation';
  createdAt: string;
  updatedAt: string;
};

export const SAVED_URL = '/api/ideas/saved';

// Refreshes the board's cached list so it is current the moment the tab opens
export async function reloadSaved() {
  const res = await fetch(SAVED_URL);
  if (res.ok) primeJson(SAVED_URL, await res.json());
}

export async function saveIdea(idea: { title: string; notes?: string; format?: string; source: SavedIdea['source'] }) {
  const res = await fetch(SAVED_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(idea) });
  if (!res.ok) {
    toast.error('Could not save that idea');
    return false;
  }
  toast.success('Saved to your idea board', { description: idea.title.slice(0, 80) });
  await reloadSaved();
  return true;
}
