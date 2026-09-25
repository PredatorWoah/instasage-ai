export type NavItem = { id: string; label: string; href: string };

// The pill tabs, in order: their position decides which way pages slide
export const NAV_TABS: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '/' },
  { id: 'analytics', label: 'Analytics', href: '/analytics' },
  { id: 'content', label: 'Content', href: '/content' },
  { id: 'insights', label: 'AI Insights', href: '/insights' },
  { id: 'recommendations', label: 'Ideas', href: '/recommendations' },
  { id: 'audience', label: 'Audience', href: '/audience' },
];

// Everything else lives in the profile menu
export const MENU_LINKS: NavItem[] = [
  { id: 'accounts', label: 'Accounts', href: '/accounts' },
  { id: 'reports', label: 'Reports', href: '/reports' },
  { id: 'competitors', label: 'Competitors', href: '/competitors' },
  { id: 'account', label: 'Profile', href: '/account' },
  { id: 'settings', label: 'Settings', href: '/settings' },
];

// Which tab a path belongs to (a post page lives under Content)
export function activeTabIndex(pathname: string) {
  if (pathname === '/') return 0;
  return NAV_TABS.findIndex((t) => t.href !== '/' && pathname.startsWith(t.href));
}
