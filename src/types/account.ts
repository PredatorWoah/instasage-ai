export interface ConnectedAccount {
  id: string;
  platform: 'instagram' | 'facebook' | 'youtube';
  username: string;
  displayName: string;
  profilePictureUrl: string;
  followerCount: number;
  isConnected: boolean;
  lastSyncedAt: string;
}
