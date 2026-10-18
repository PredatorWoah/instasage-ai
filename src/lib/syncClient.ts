'use client';

import { toast } from 'sonner';
import { clearJsonCache } from '@/lib/useCachedJson';
import { STATUS_CHANGED } from '@/lib/status';

type SyncResult = { previous: number; followers: number; posts: number };

// Syncs one account and tells the user what the platform actually reported
export async function syncAccount(id: string, label: string, unit = 'followers', quiet = false): Promise<boolean> {
  try {
    const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: id }) });
    const data = (await res.json().catch(() => ({}))) as Partial<SyncResult> & { error?: string };
    if (!res.ok) {
      toast.error(`${label} did not sync`, { description: data.error });
      return false;
    }
    if (quiet) return true;
    const { previous, followers, posts } = data as SyncResult;
    const diff = followers - previous;
    if (diff !== 0) {
      toast.success(`${label}: ${followers.toLocaleString()} ${unit}`, { description: `${diff > 0 ? '+' : ''}${diff} since the last sync. ${posts} posts refreshed.` });
    } else {
      toast.success(`${label} synced: ${followers.toLocaleString()} ${unit}`, {
        description: `Same as before, because that is what the platform reports right now (its count can trail the app by a few minutes to hours). ${posts} posts refreshed.`,
      });
    }
    return true;
  } catch {
    toast.error(`${label} did not sync`, { description: 'Could not reach the server.' });
    return false;
  } finally {
    clearJsonCache();
    window.dispatchEvent(new Event(STATUS_CHANGED));
  }
}
