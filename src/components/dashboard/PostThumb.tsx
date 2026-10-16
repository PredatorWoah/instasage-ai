'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageIcon, Play } from 'lucide-react';
import { formatLabel } from '@/lib/platform';

// Instagram's image links expire after a few days. When one has, show a tidy placeholder
// instead of a broken image (the next sync brings back a fresh link).
export function PostThumb({ src, type, sizes, zoom = true }: { src?: string | null; type: string; sizes: string; zoom?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const Icon = ['reel', 'video', 'short'].includes(type) ? Play : ImageIcon;
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/90">
        <Icon className="w-5 h-5" />
        <span className="text-[11px] font-bold">{formatLabel(type)}</span>
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      sizes={sizes}
      onError={() => setFailed(true)}
      className={zoom ? 'object-cover transition-transform duration-500 group-hover:scale-[1.06]' : 'object-cover'}
    />
  );
}
