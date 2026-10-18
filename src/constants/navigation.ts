import {
  Activity, BarChart3, FileText, Grid2X2, LayoutDashboard, Lightbulb, MessageCircle, Settings, Sparkles, Swords, UserCheck, UserRound, Users,
  type LucideIcon,
} from 'lucide-react';

// Every page carries its own icon, so a new page can never render without one
export type NavItem = { id: string; label: string; href: string; icon: LucideIcon };

// The pill tabs, in order: their position decides which way pages slide
export const NAV_TABS: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '/', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { id: 'content', label: 'Content', href: '/content', icon: Grid2X2 },
  { id: 'insights', label: 'AI Insights', href: '/insights', icon: Sparkles },
  { id: 'recommendations', label: 'Ideas', href: '/recommendations', icon: Lightbulb },
  { id: 'audience', label: 'Audience', href: '/audience', icon: Users },
];

// Everything else lives in the profile menu
export const MENU_LINKS: NavItem[] = [
  { id: 'accounts', label: 'Accounts', href: '/accounts', icon: UserCheck },
  { id: 'reports', label: 'Reports', href: '/reports', icon: FileText },
  { id: 'competitors', label: 'Competitors', href: '/competitors', icon: Swords },
  { id: 'comments', label: 'Comments', href: '/comments', icon: MessageCircle },
  { id: 'account', label: 'Profile', href: '/account', icon: UserRound },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
  { id: 'status', label: 'Status', href: '/status', icon: Activity },
];

// Which tab a path belongs to (a post page lives under Content)
export function activeTabIndex(pathname: string) {
  if (pathname === '/') return 0;
  return NAV_TABS.findIndex((t) => t.href !== '/' && pathname.startsWith(t.href));
}
