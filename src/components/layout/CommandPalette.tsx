'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ArrowRight, FileText, Hash, LogOut, Moon, RefreshCw, Search, Sun, Monitor, User, Zap } from 'lucide-react';
import { NAV_TABS, MENU_LINKS } from '@/constants/navigation';
import { useCachedJson } from '@/lib/useCachedJson';
import { ACCOUNT_COOKIE, usePlatform } from '@/lib/usePlatform';
import { syncAccount } from '@/lib/syncClient';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Post } from '@/types';

type Command = { id: string; group: string; label: string; hint?: string; keywords?: string; icon: typeof Search; run: () => void | Promise<void> };

export const OPEN_PALETTE = 'instasage:open-palette';

const JUMPS: { label: string; href: string; keywords: string }[] = [
  { label: 'Game plan', href: '/recommendations', keywords: 'plan strategy 30 days pillars' },
  { label: 'Brainstorm with Sage', href: '/recommendations?tab=brainstorm', keywords: 'chat ideas ai' },
  { label: 'Idea board', href: '/recommendations?tab=board', keywords: 'saved ideas planned posted kanban' },
  { label: 'Quick wins', href: '/recommendations?tab=quick', keywords: 'tips easy' },
  { label: 'Best time to post', href: '/audience#best-time', keywords: 'heatmap schedule hour day when' },
  { label: 'Creator profile', href: '/account#creator-profile', keywords: 'niche voice audience goals' },
  { label: 'AI keys and models', href: '/settings#ai', keywords: 'gemini claude openai openrouter api key provider' },
  { label: 'AI usage and cost', href: '/settings#usage', keywords: 'tokens spend price' },
  { label: 'Appearance', href: '/settings#appearance', keywords: 'theme dark light' },
  { label: 'Timezone', href: '/settings#timezone', keywords: 'time zone local' },
];

function score(c: Command, q: string) {
  if (!q) return 1;
  const label = c.label.toLowerCase();
  if (label.startsWith(q)) return 3;
  if (label.includes(q)) return 2;
  const words = q.split(/\s+/);
  const hay = `${label} ${c.keywords ?? ''} ${c.group.toLowerCase()}`;
  return words.every((w) => hay.includes(w)) ? 1 : 0;
}

// Ctrl+K / Cmd+K: jump to any page, section or post, switch accounts, sync, or change the theme
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE, onOpen);
    };
  }, []);

  if (!open) return null;
  return createPortal(<Palette onClose={() => setOpen(false)} />, document.body);
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { profiles, selected } = usePlatform();
  const { setChoice } = useTheme();
  const { data: posts } = useCachedJson<Post[]>('/api/posts');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const pages = [...NAV_TABS, ...MENU_LINKS].map((t) => ({ id: `page:${t.id}`, group: 'Pages', label: t.label, keywords: t.id, icon: ArrowRight, run: go(t.href) }));
    const jumps = JUMPS.map((j) => ({ id: `jump:${j.href}`, group: 'Jump to', label: j.label, keywords: j.keywords, icon: Hash, run: go(j.href) }));
    const choose = (id: string) => () => {
      document.cookie = `${ACCOUNT_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
      window.location.reload();
    };
    const accounts: Command[] = [
      ...(profiles.length > 1 && selected !== 'all' ? [{ id: 'acct:all', group: 'Accounts', label: 'Show all accounts', keywords: 'switch', icon: User, run: choose('all') }] : []),
      ...profiles.filter((p) => p.id !== selected).map((p) => ({ id: `acct:${p.id}`, group: 'Accounts', label: `Switch to @${p.username}`, hint: p.platform === 'youtube' ? 'YouTube' : 'Instagram', keywords: 'account switch', icon: User, run: choose(p.id) })),
    ];
    const actions: Command[] = [
      ...(profiles.length ? [{
        id: 'sync', group: 'Actions', label: 'Sync all accounts now', keywords: 'refresh update fetch', icon: RefreshCw,
        run: async () => {
          for (const p of profiles) await syncAccount(p.id, `@${p.username}`, p.platform === 'youtube' ? 'subscribers' : 'followers');
          router.refresh();
        },
      }] : []),
      { id: 'theme:light', group: 'Actions', label: 'Light theme', keywords: 'appearance mode', icon: Sun, run: () => setChoice('light') },
      { id: 'theme:dark', group: 'Actions', label: 'Dark theme', keywords: 'appearance mode', icon: Moon, run: () => setChoice('dark') },
      { id: 'theme:system', group: 'Actions', label: 'Theme: match device', keywords: 'appearance mode system auto', icon: Monitor, run: () => setChoice('system') },
      { id: 'ideas', group: 'Actions', label: 'Get fresh post ideas', keywords: 'brainstorm new', icon: Zap, run: go('/recommendations?tab=brainstorm') },
      { id: 'signout', group: 'Actions', label: 'Sign out', keywords: 'log out logout', icon: LogOut, run: () => signOut({ callbackUrl: '/login' }) },
    ];
    return [...pages, ...jumps, ...accounts, ...actions];
  }, [router, profiles, selected, setChoice]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ranked = commands.map((c) => ({ c, s: score(c, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.c);
    if (q.length < 2 || !posts) return ranked;
    const found: Command[] = posts
      .filter((p) => p.caption.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        id: `post:${p.id}`,
        group: 'Posts',
        label: p.caption.replace(/\s+/g, ' ').slice(0, 90) || 'Untitled',
        hint: new Date(p.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        icon: FileText,
        run: () => router.push(`/content/${encodeURIComponent(p.id)}`),
      }));
    const more: Command[] = [{ id: 'search', group: 'Posts', label: `Search all posts for "${query.trim()}"`, icon: Search, run: () => router.push(`/content?q=${encodeURIComponent(query.trim())}`) }];
    return [...ranked, ...found, ...more];
  }, [commands, posts, query, router]);

  const current = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    void c.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((current + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((current - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[current]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[4px] animate-[fade-in_160ms_ease-out_both]" />
      <div className="acrylic-panel relative w-full max-w-xl rounded-[26px] overflow-hidden animate-[drop-in_220ms_cubic-bezier(0.22,1,0.36,1)_both]">
        <div className="flex items-center gap-3 px-4 border-b border-ink/[0.08]">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page, post or action..."
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[current] ? `palette-${current}` : undefined}
            className="flex-1 h-14 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline text-[10px] font-bold text-muted-foreground border border-ink/[0.12] rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={list} id="palette-list" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="text-sm text-muted-foreground px-3 py-6 text-center">Nothing matches &quot;{query}&quot;</p>}
          {results.map((c, i) => {
            const header = c.group !== results[i - 1]?.group ? c.group : null;
            return (
              <div key={c.id}>
                {header && <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{header}</p>}
                <button
                  type="button"
                  id={`palette-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === current}
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={() => run(c)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm', i === current ? 'bg-ink/[0.09]' : 'hover:bg-ink/[0.05]')}
                >
                  <c.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="text-[11px] text-muted-foreground shrink-0">{c.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-ink/[0.08] text-[11px] text-muted-foreground">
          <span>↑↓ to move</span><span>Enter to open</span><span className="ml-auto">Ctrl+K anywhere</span>
        </div>
      </div>
    </div>
  );
}
