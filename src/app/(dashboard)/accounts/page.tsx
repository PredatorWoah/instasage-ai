'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus, Check, RefreshCw, AlertCircle, Link2Off } from 'lucide-react';
import { toast } from 'sonner';

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockAccounts } from '@/data/mockAccounts';
import { formatNumber } from '@/utils/formatters';
import type { ConnectedAccount } from '@/types/account';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(mockAccounts);

  const toggleConnection = (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === id) {
          const nextState = !acc.isConnected;
          if (nextState) {
            toast.success('Account Connected', {
              description: `Instagram account @${acc.username} has been linked.`,
            });
          } else {
            toast.info('Account Disconnected', {
              description: `Instagram account @${acc.username} has been unlinked.`,
            });
          }
          return {
            ...acc,
            isConnected: nextState,
            lastSyncedAt: nextState ? new Date().toISOString() : 'Never',
          };
        }
        return acc;
      })
    );
  };

  const handleAddAccount = () => {
    toast.success('Instagram Authentication Flow', {
      description: 'Redirecting to mock Instagram authorization portal... (Offline demo)',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Connected Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your connected social platforms and accounts credentials
          </p>
        </div>
        <Button
          onClick={handleAddAccount}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5 font-semibold shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Instagram Account
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <Card
            key={acc.id}
            className="bg-secondary/20 border-border overflow-hidden hover:border-border/80 transition-colors flex flex-col justify-between"
          >
            <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center gap-4 space-y-0">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border border-border shrink-0 bg-secondary">
                <Image
                  src={acc.profilePictureUrl}
                  alt={acc.displayName}
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold truncate text-foreground leading-none">
                    {acc.displayName}
                  </h3>
                  <InstagramIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">@{acc.username}</p>
              </div>
            </CardHeader>

            <CardContent className="px-5 pb-5 pt-0 space-y-4">
              {/* Followers count and sync info */}
              <div className="flex items-center justify-between text-xs py-2 border-t border-b border-border/40">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider">Followers</p>
                  <p className="text-foreground font-bold mt-0.5">{formatNumber(acc.followerCount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider">Last Sync</p>
                  <p className="text-foreground mt-0.5 font-medium">
                    {acc.isConnected && acc.lastSyncedAt !== 'Never'
                      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(acc.lastSyncedAt))
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Status and Action Buttons */}
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
                  onClick={() => toggleConnection(acc.id)}
                  variant={acc.isConnected ? 'outline' : 'default'}
                  size="sm"
                  className={`text-xs h-8 px-3.5 gap-1.5 ${
                    acc.isConnected
                      ? 'border-border text-muted-foreground hover:text-red-400 hover:bg-red-500/5'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {acc.isConnected ? (
                    <>
                      <Link2Off className="w-3.5 h-3.5" /> Disconnect
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Connect
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
