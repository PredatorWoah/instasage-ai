'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ConnectedAccounts } from '@/components/accounts/ConnectedAccounts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/utils/formatters';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

function AccountsContent() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const router = useRouter();

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        return data as { id: string; username: string }[];
      }
    } catch {
      toast.error('Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
    return [];
  };

  const syncProfile = async (accId: string, quiet = false) => {
    setSyncing((prev) => ({ ...prev, [accId]: true }));
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: accId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (!quiet) toast.success('Sync complete');
      } else {
        toast.error('Sync failed', { description: data.error });
      }
      return res.ok;
    } catch {
      toast.error('Sync failed', { description: 'Could not reach the server.' });
      return false;
    } finally {
      setSyncing((prev) => ({ ...prev, [accId]: false }));
    }
  };

  const handleSync = async (accId: string) => {
    await syncProfile(accId);
    fetchAccounts();
  };

  const syncAll = async () => {
    toast.info(`Syncing ${accounts.length} accounts...`);
    let ok = 0;
    for (const acc of accounts) if (await syncProfile(acc.id, true)) ok += 1;
    toast.success(`Synced ${ok} of ${accounts.length} accounts`);
    fetchAccounts();
  };

  useEffect(() => {
    const error = searchParams.get('error');
    const connected = searchParams.get('connected');
    fetchAccounts().then((list) => {
      // Fresh from Instagram login: pull in posts straight away
      const added = connected && list.find((a) => a.username === connected);
      if (added) {
        toast.success(`Connected @${connected}`, { description: 'Syncing posts and insights now...' });
        syncProfile(added.id).then(() => fetchAccounts());
      }
    });
    if (error) toast.error('Instagram connection failed', { description: error });
    if (error || connected) router.replace('/accounts');
  }, [searchParams, router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Connected Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your connected accounts. Use the switcher in the top bar to view one account or all of them.
          </p>
        </div>
        {accounts.length > 1 && (
          <Button onClick={syncAll} disabled={Object.values(syncing).some(Boolean)} size="sm" className="text-xs h-8 gap-1.5 self-start bg-indigo-600 hover:bg-indigo-700">
            <RefreshCw className={`w-3.5 h-3.5 ${Object.values(syncing).some(Boolean) ? 'animate-spin' : ''}`} /> Sync all
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
           <div className="h-48 bg-secondary/10 border border-border/50 rounded-xl animate-pulse" />
        ) : accounts.length === 0 ? (
          <div className="col-span-full max-w-xl p-5 border border-dashed rounded-xl border-border space-y-3">
             <p className="text-muted-foreground text-sm">No accounts connected yet. Connect your Instagram to start.</p>
             <ConnectedAccounts onChange={fetchAccounts} />
          </div>
        ) : accounts.map((acc) => (
          <Card
            key={acc.id}
            className="bg-secondary/20 border-border overflow-hidden hover:border-border/80 transition-colors flex flex-col justify-between"
          >
            <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center gap-4 space-y-0">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border border-border shrink-0 bg-secondary">
                {acc.profilePictureUrl ? (
                  <Image src={acc.profilePictureUrl} alt={acc.displayName} fill className="object-cover" sizes="48px" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-500/20 text-indigo-500 font-bold">{acc.displayName?.[0]}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold truncate text-foreground leading-none">
                    {acc.displayName}
                  </h3>
                  {acc.platform === 'instagram' && <InstagramIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">@{acc.username}</p>
              </div>
            </CardHeader>

            <CardContent className="px-5 pb-5 pt-0 space-y-4">
              <div className="flex items-center justify-between text-xs py-2 border-t border-b border-border/40">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider">Followers</p>
                  <p className="text-foreground font-bold mt-0.5">{formatNumber(acc.followerCount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider">Last Sync</p>
                  <p className="text-foreground mt-0.5 font-medium">
                    {acc.isConnected && acc.lastSyncedAt
                      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(acc.lastSyncedAt))
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <div>
                  {acc.isConnected ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-2 py-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 flex items-center gap-1 border-transparent">
                      <AlertCircle className="w-3 h-3 text-muted-foreground" />
                      Disconnected
                    </Badge>
                  )}
                </div>

                <Button
                  onClick={() => handleSync(acc.id)}
                  disabled={syncing[acc.id]}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 px-3.5 gap-1.5 border-border text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing[acc.id] ? 'animate-spin' : ''}`} /> {syncing[acc.id] ? 'Syncing...' : 'Sync'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {accounts.length > 0 && (
        <Card className="bg-secondary/20 border-border max-w-xl">
          <CardHeader className="pb-2 pt-4 px-5">
            <h2 className="text-sm font-semibold">Add or remove accounts</h2>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ConnectedAccounts onChange={fetchAccounts} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="h-96 bg-secondary/10 border border-border/50 rounded-xl animate-pulse" />}>
      <AccountsContent />
    </Suspense>
  );
}
