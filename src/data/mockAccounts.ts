import type { ConnectedAccount } from '@/types/account';

export const mockAccounts: ConnectedAccount[] = [
  {
    id: 'inst-1',
    platform: 'instagram',
    username: 'travel_escape',
    displayName: 'Travel & Escape',
    profilePictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    followerCount: 245000,
    isConnected: true,
    lastSyncedAt: '2024-07-13T09:00:00Z',
  },
  {
    id: 'inst-2',
    platform: 'instagram',
    username: 'tech_creator',
    displayName: 'Tech Creator Studio',
    profilePictureUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    followerCount: 89200,
    isConnected: true,
    lastSyncedAt: '2024-07-13T08:30:00Z',
  },
  {
    id: 'inst-3',
    platform: 'instagram',
    username: 'foodie_explorer',
    displayName: 'Foodie Explorer',
    profilePictureUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    followerCount: 12800,
    isConnected: false,
    lastSyncedAt: 'Never',
  },
];
