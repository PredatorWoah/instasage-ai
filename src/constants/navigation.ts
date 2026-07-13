export type NavItem = {
  id: string;
  label: string;
  href: string;
  iconName: string;
  badge?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/', iconName: 'LayoutDashboard' },
  { id: 'accounts', label: 'Accounts', href: '/accounts', iconName: 'UserCheck' },
  { id: 'analytics', label: 'Analytics', href: '/analytics', iconName: 'BarChart3' },
  { id: 'content', label: 'Content Library', href: '/content', iconName: 'Grid2X2' },
  { id: 'insights', label: 'AI Insights', href: '/insights', iconName: 'Sparkles', badge: 'AI' },
  { id: 'recommendations', label: 'Recommendations', href: '/recommendations', iconName: 'Lightbulb' },
  { id: 'audience', label: 'Audience', href: '/audience', iconName: 'Users' },
  { id: 'competitors', label: 'Competitors', href: '/competitors', iconName: 'Swords' },
  { id: 'reports', label: 'Reports', href: '/reports', iconName: 'FileText' },
  { id: 'settings', label: 'Settings', href: '/settings', iconName: 'Settings' },
];
