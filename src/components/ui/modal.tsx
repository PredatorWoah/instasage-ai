'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Frosted sheet: a bottom sheet on phones, a centred card on bigger screens. Esc or a tap outside closes it.
export function Modal({ open, onClose, title, subtitle, children, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[6px] animate-[fade-in_200ms_ease-out_both]" />
      <div className={cn('acrylic-panel relative w-full max-h-[92vh] overflow-y-auto rounded-t-[30px] sm:rounded-[30px] p-5 sm:p-6 space-y-4 animate-[drop-in_320ms_cubic-bezier(0.22,1,0.36,1)_both]', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{title}</h2>
            {subtitle && <div className="text-[13px] text-muted-foreground mt-1">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 rounded-full hover:bg-ink/[0.08] shrink-0" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
