// Shape of /api/status, shared by the banner, the checklist and the Status page
export type AccountHealth = {
  id: string;
  platform: string;
  username: string;
  isConnected: boolean;
  tokenExpiresAt: string | null;
  lastSyncedAt: string;
  lastJob: { status: string; error: string | null; at: string } | null;
  problems: ('disconnected' | 'token_expired' | 'token_expiring' | 'sync_failed')[];
};

export type AppStatus = {
  accounts: AccountHealth[];
  ai: { provider: string; label: string; model: string | null; saved: string[] } | null;
  timezone: string | null;
  youtubeKey: boolean;
  facebook: { igUsername: string; expiresAt: string | null; expired: boolean } | null;
  setup: { dismissed: boolean; steps: Record<'account' | 'synced' | 'ai' | 'timezone' | 'profile' | 'goal', boolean> };
  jobs: { id: string; username: string; platform: string; status: string; error: string | null; at: string; seconds: number | null }[];
  version: string | null;
};

export const STATUS_URL = '/api/status';

// Fired after anything that changes setup or account health, so the checklist and banner refetch
export const STATUS_CHANGED = 'instasage:status-changed';
